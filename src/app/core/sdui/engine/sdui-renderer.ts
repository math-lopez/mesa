import {
  ComponentRef,
  DestroyRef,
  Directive,
  Injector,
  OutputEmitterRef,
  Signal,
  Type,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  untracked,
} from '@angular/core';

import { SduiEventEmitter, SduiNode } from '../models';
import { SduiComponentRegistry } from '../registry/sdui-component-registry';
import { SduiFallbackComponent } from '../registry/sdui-fallback.component';
import { SduiNodeBinder } from './sdui-node-binder';
import { SDUI_NODE } from './sdui-node.token';
import { SduiResolver } from './sdui-resolver';

/**
 * Núcleo do Dynamic Component Loader.
 *
 * Mantém uma lista de nós sincronizada com o `ViewContainerRef` do host:
 *  - cria cada componente com `createComponent` + `inputBinding` (props reativas via signal);
 *  - fornece um injector por nó (com `SDUI_NODE`) para permitir recursão via `sduiSlot`;
 *  - reconcilia por identidade do nó quando `visibleWhen` muda — só cria/destroi o que mudou,
 *    preservando os demais componentes (e seu foco/scroll).
 *
 * Deve ser instanciado em contexto de injeção (construtor de diretiva).
 */
class SduiNodeListRenderer {
  readonly #vcr = inject(ViewContainerRef);
  readonly #injector = inject(Injector);
  readonly #registry = inject(SduiComponentRegistry);
  readonly #binder = inject(SduiNodeBinder);
  readonly #resolver = inject(SduiResolver);
  readonly #refs = new Map<SduiNode, ComponentRef<unknown>>();

  constructor(nodes: Signal<readonly SduiNode[]>) {
    const visible = computed(
      () => nodes().filter((node) => this.#resolver.evaluate(node.visibleWhen)),
      { equal: sameNodes },
    );

    effect(() => {
      const list = visible();
      untracked(() => this.#reconcile(list));
    });

    inject(DestroyRef).onDestroy(() => this.#refs.clear());
  }

  #reconcile(nodes: readonly SduiNode[]): void {
    const wanted = new Set(nodes);
    for (const [node, ref] of this.#refs) {
      if (!wanted.has(node)) {
        ref.destroy();
        this.#refs.delete(node);
      }
    }

    nodes.forEach((node, index) => {
      const ref = this.#refs.get(node) ?? this.#create(node, index);
      if (this.#vcr.indexOf(ref.hostView) !== index) {
        this.#vcr.move(ref.hostView, index);
      }
    });
  }

  /** Um wrapper com defeito vira fallback — não derruba os irmãos nem a tela inteira. */
  #create(node: SduiNode, index: number): ComponentRef<unknown> {
    try {
      return this.#instantiate(node, index, this.#registry.get(node.type));
    } catch (error) {
      console.error(`[SDUI] Falha ao renderizar "${node.type}" (id: ${node.id}).`, error);
      return this.#instantiate(node, index, SduiFallbackComponent);
    }
  }

  #instantiate(node: SduiNode, index: number, component: Type<unknown>): ComponentRef<unknown> {
    const binding = this.#binder.bind(node);
    const injector = Injector.create({
      providers: [{ provide: SDUI_NODE, useValue: node }],
      parent: this.#injector,
    });

    let ref: ComponentRef<unknown>;
    try {
      ref = this.#vcr.createComponent(component, {
        index,
        injector,
        bindings: [inputBinding('props', binding.props)],
      });
    } catch (error) {
      binding.dispose();
      throw error;
    }

    // Wrappers interativos expõem `sduiEvent`; os de exibição não precisam declará-lo.
    const emitter = (ref.instance as Partial<SduiEventEmitter>).sduiEvent;
    if (emitter instanceof OutputEmitterRef) {
      emitter.subscribe(binding.handle); // encerrada automaticamente no destroy do componente
    }

    ref.onDestroy(binding.dispose);
    const host = ref.location.nativeElement as HTMLElement;
    host.setAttribute('data-sdui-id', node.id);
    // Dica de layout agnóstica de DS: o container decide como usar `--ds-span`.
    if (node.span) host.style.setProperty('--ds-span', String(node.span));
    this.#refs.set(node, ref);
    return ref;
  }
}

function sameNodes(a: readonly SduiNode[], b: readonly SduiNode[]): boolean {
  return a.length === b.length && a.every((node, i) => node === b[i]);
}

/** Renderiza uma lista explícita de nós. Usado na raiz da tela. */
@Directive({ selector: '[sduiOutlet]' })
export class SduiOutletDirective {
  readonly nodes = input.required<readonly SduiNode[]>({ alias: 'sduiOutlet' });

  constructor() {
    new SduiNodeListRenderer(this.nodes);
  }
}

/**
 * Usado DENTRO dos wrappers de container para renderizar os filhos do nó:
 *   `<ng-container sduiSlot />`          → `children`
 *   `<ng-container sduiSlot="footer" />` → `slots.footer`
 * É o único ponto de contato de um wrapper com o motor.
 */
@Directive({ selector: '[sduiSlot]' })
export class SduiSlotDirective {
  readonly slot = input('', { alias: 'sduiSlot' });
  readonly #node = inject(SDUI_NODE);

  constructor() {
    const nodes = computed(() => {
      const name = this.slot();
      return (name ? this.#node.slots?.[name] : this.#node.children) ?? [];
    });
    new SduiNodeListRenderer(nodes);
  }
}
