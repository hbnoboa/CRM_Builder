'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizeHref } from '@/lib/normalize-href';
import {
  Action,
  ComponentEvent,
  ExpressionContext,
  evaluateExpression,
  evaluateCondition,
} from '@/lib/page-events';

// Estado global dos componentes na pagina
interface PageState {
  components: Record<string, ComponentState>;
  form: Record<string, unknown>;
  page: {
    params: Record<string, string>;
    query: Record<string, string>;
  };
  user: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

interface ComponentState {
  value?: unknown;
  loading?: boolean;
  visible?: boolean;
  data?: unknown;
  error?: string;
  filterParams?: Record<string, unknown>;
}

// Hook principal
export function usePageEvents(initialState?: Partial<PageState>) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>({
    components: {},
    form: {},
    page: {
      params: {},
      query: {},
    },
    user: {},
    ...initialState,
  });

  // Ref para listeners de refresh
  const refreshListeners = useRef<Record<string, () => void>>({});

  // Registra componente
  const registerComponent = useCallback(
    (componentId: string, initialState?: Partial<ComponentState>) => {
      setPageState((prev) => ({
        ...prev,
        components: {
          ...prev.components,
          [componentId]: {
            visible: true,
            loading: false,
            ...initialState,
          },
        },
      }));
    },
    []
  );

  // Atualiza estado de um componente
  const updateComponentState = useCallback(
    (componentId: string, updates: Partial<ComponentState>) => {
      setPageState((prev) => ({
        ...prev,
        components: {
          ...prev.components,
          [componentId]: {
            ...prev.components[componentId],
            ...updates,
          },
        },
      }));
    },
    []
  );

  // Obtem estado de um componente
  const getComponentState = useCallback(
    (componentId: string): ComponentState | undefined => {
      return pageState.components[componentId];
    },
    [pageState.components]
  );

  // Registra listener de refresh
  const registerRefreshListener = useCallback(
    (componentId: string, callback: () => void) => {
      refreshListeners.current[componentId] = callback;
      return () => {
        delete refreshListeners.current[componentId];
      };
    },
    []
  );

  // Executa uma acao
  const executeAction = useCallback(
    async (
      action: Action,
      context: ExpressionContext
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      // Verifica condicao
      if (action.condition && !evaluateCondition(action.condition, context)) {
        return { success: true }; // Pula acao se condicao nao atendida
      }

      // Delay se configurado
      if (action.delay) {
        await new Promise((resolve) => setTimeout(resolve, action.delay));
      }

      try {
        switch (action.type) {
          case 'callApi': {
            const path = evaluateExpression(
              action.apiPath || '',
              context
            ) as string;
            const method = action.apiMethod || 'GET';

            let body = action.apiBody;
            if (typeof body === 'string') {
              body = evaluateExpression(body, context) as string;
              try {
                body = JSON.parse(body as string);
              } catch {
                // Keep as string if not valid JSON
              }
            } else if (body && typeof body === 'object') {
              // Evaluate expressions in object values
              body = JSON.parse(
                evaluateExpression(JSON.stringify(body), context) as string
              );
            }

            const response = await api.request({
              method,
              url: path,
              data: body,
              headers: action.apiHeaders,
            });

            const newContext: ExpressionContext = {
              ...context,
              response: {
                data: response.data,
                status: response.status,
                success: true,
              },
            };

            // Executa onSuccess se configurado
            if (action.onSuccess?.length) {
              await executeActions(action.onSuccess, newContext);
            }

            return { success: true, data: response.data };
          }

          case 'setValue': {
            if (action.targetComponentId) {
              const value = evaluateExpression(
                String(action.value || ''),
                context
              );
              updateComponentState(action.targetComponentId, {
                value,
                ...(action.targetField && { [action.targetField]: value }),
              });
            }
            return { success: true };
          }

          case 'filterData': {
            if (action.filterComponentId) {
              const filterValue = evaluateExpression(
                action.filterValue || '',
                context
              );
              updateComponentState(action.filterComponentId, {
                filterParams: {
                  ...pageState.components[action.filterComponentId]
                    ?.filterParams,
                  [action.filterField || 'filter']: filterValue,
                },
              });

              // Trigger refresh do componente filtrado
              const refreshFn =
                refreshListeners.current[action.filterComponentId];
              if (refreshFn) {
                refreshFn();
              }
            }
            return { success: true };
          }

          case 'navigate': {
            const url = evaluateExpression(
              action.navigateTo || '',
              context
            ) as string;

            // Normaliza o URL para garantir navegacao correta
            const normalizedUrl = normalizeHref(url);

            if (action.openInNewTab) {
              window.open(normalizedUrl, '_blank');
            } else {
              router.push(normalizedUrl);
            }
            return { success: true };
          }

          case 'showToast': {
            const message = evaluateExpression(
              action.toastMessage || '',
              context
            ) as string;
            const duration = action.toastDuration || 3000;

            switch (action.toastType) {
              case 'success':
                toast.success(message, { duration });
                break;
              case 'error':
                toast.error(message, { duration });
                break;
              case 'warning':
                toast.warning(message, { duration });
                break;
              case 'info':
              default:
                toast.info(message, { duration });
                break;
            }
            return { success: true };
          }

          case 'showModal': {
            // Emit evento para modal manager
            const event = new CustomEvent('page:showModal', {
              detail: {
                modalId: action.modalId,
                title: evaluateExpression(action.modalTitle || '', context),
                content: evaluateExpression(action.modalContent || '', context),
              },
            });
            window.dispatchEvent(event);
            return { success: true };
          }

          case 'closeModal': {
            const event = new CustomEvent('page:closeModal', {
              detail: { modalId: action.modalId },
            });
            window.dispatchEvent(event);
            return { success: true };
          }

          case 'refresh': {
            if (action.refreshComponentId) {
              const refreshFn =
                refreshListeners.current[action.refreshComponentId];
              if (refreshFn) {
                refreshFn();
              }
            }
            return { success: true };
          }

          case 'setVisibility': {
            if (action.visibilityComponentId) {
              const currentState =
                pageState.components[action.visibilityComponentId];
              const currentVisible = currentState?.visible ?? true;

              let newVisible = currentVisible;
              switch (action.visibilityAction) {
                case 'show':
                  newVisible = true;
                  break;
                case 'hide':
                  newVisible = false;
                  break;
                case 'toggle':
                  newVisible = !currentVisible;
                  break;
              }

              updateComponentState(action.visibilityComponentId, {
                visible: newVisible,
              });
            }
            return { success: true };
          }

          case 'setLoading': {
            if (action.loadingComponentId) {
              updateComponentState(action.loadingComponentId, {
                loading: action.loadingState ?? true,
              });
            }
            return { success: true };
          }

          case 'runActions': {
            // TODO: Implementar grupos de acoes reutilizaveis
            return { success: true };
          }

          default:
            return { success: false, error: `Unknown action type: ${action.type}` };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Executa onError se configurado
        if (action.onError?.length) {
          const errorContext: ExpressionContext = {
            ...context,
            response: {
              success: false,
              error: errorMessage,
            },
          };
          await executeActions(action.onError, errorContext);
        }

        return { success: false, error: errorMessage };
      }
    },
    [pageState.components, router, updateComponentState]
  );

  // Executa multiplas acoes em sequencia ou paralelo
  const executeActions = useCallback(
    async (
      actions: Action[],
      context: ExpressionContext
    ): Promise<{ success: boolean; results: unknown[] }> => {
      const results: unknown[] = [];

      for (const action of actions) {
        if (action.async) {
          // Executa em paralelo (nao espera)
          executeAction(action, context).then((result) => {
            results.push(result);
          });
        } else {
          // Executa em sequencia (espera terminar)
          const result = await executeAction(action, context);
          results.push(result);

          // Se falhou e nao tem onError, para execucao
          if (!result.success && !action.onError?.length) {
            return { success: false, results };
          }

          // Atualiza contexto com resultado para proxima acao
          if (result.data) {
            context = {
              ...context,
              response: {
                data: result.data,
                success: true,
              },
            };
          }
        }
      }

      return { success: true, results };
    },
    [executeAction]
  );

  // Handler para disparar evento de um componente
  const triggerEvent = useCallback(
    async (
      componentId: string,
      event: ComponentEvent,
      eventData?: {
        value?: unknown;
        target?: unknown;
      }
    ) => {
      if (!event.enabled) return;

      const context: ExpressionContext = {
        event: {
          type: event.type,
          value: eventData?.value,
          target: eventData?.target,
        },
        form: pageState.form,
        page: pageState.page,
        user: pageState.user,
        components: Object.fromEntries(
          Object.entries(pageState.components).map(([id, state]) => [
            id,
            state.value,
          ])
        ),
      };

      // Verifica condicao do evento
      if (event.condition && !evaluateCondition(event.condition, context)) {
        return;
      }

      // Executa acoes do evento
      await executeActions(event.actions, context);
    },
    [pageState, executeActions]
  );

  // Cria handler de evento para um componente
  const createEventHandler = useCallback(
    (componentId: string, events: ComponentEvent[] = []) => {
      return {
        onClick: (value?: unknown) => {
          const event = events.find((e) => e.type === 'onClick');
          if (event) {
            triggerEvent(componentId, event, { value });
          }
        },
        onChange: (value: unknown) => {
          // Atualiza valor do componente
          updateComponentState(componentId, { value });

          const event = events.find((e) => e.type === 'onChange');
          if (event) {
            triggerEvent(componentId, event, { value });
          }
        },
        onSubmit: (formData: Record<string, unknown>) => {
          // Atualiza form state
          setPageState((prev) => ({
            ...prev,
            form: { ...prev.form, ...formData },
          }));

          const event = events.find((e) => e.type === 'onSubmit');
          if (event) {
            triggerEvent(componentId, event, { value: formData });
          }
        },
        onLoad: () => {
          const event = events.find((e) => e.type === 'onLoad');
          if (event) {
            triggerEvent(componentId, event);
          }
        },
      };
    },
    [triggerEvent, updateComponentState]
  );

  return {
    pageState,
    setPageState,
    registerComponent,
    updateComponentState,
    getComponentState,
    registerRefreshListener,
    triggerEvent,
    createEventHandler,
    executeAction,
    executeActions,
  };
}

// Provider context para usar em toda a pagina
import { createContext, useContext, ReactNode } from 'react';

const PageEventsContext = createContext<ReturnType<
  typeof usePageEvents
> | null>(null);

export function PageEventsProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<PageState>;
}) {
  const pageEvents = usePageEvents(initialState);

  return (
    <PageEventsContext.Provider value={pageEvents}>
      {children}
    </PageEventsContext.Provider>
  );
}

export function usePageEventsContext() {
  const context = useContext(PageEventsContext);
  if (!context) {
    throw new Error(
      'usePageEventsContext must be used within PageEventsProvider'
    );
  }
  return context;
}
