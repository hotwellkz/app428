import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  route: string;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      route: window.location.pathname
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      route: window.location.pathname
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Логируем детальную информацию
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Route:', window.location.pathname);
    console.error('Error message:', error.message);
    
    // Логируем состояние компонента, если доступно
    if (error.message.includes('306')) {
      console.error('React Error #306 detected - likely rendering undefined/null as component');
      console.error('Check for:');
      console.error('1. <Icon /> where Icon is undefined');
      console.error('2. onClick={handler(x)} instead of onClick={() => handler(x)}');
      console.error('3. children containing undefined/object');
      console.error('4. Missing context/provider');
    }

    this.setState({
      error,
      errorInfo,
      route: window.location.pathname
    });

    // Можно отправить в систему мониторинга
    // reportErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Произошла ошибка</h2>
            <div className="space-y-2 mb-4">
              <p className="text-gray-700">
                <strong>Маршрут:</strong> {this.state.route}
              </p>
              <p className="text-gray-700">
                <strong>Ошибка:</strong> {this.state.error?.message || 'Неизвестная ошибка'}
              </p>
              {this.state.error?.message.includes('306') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
                  <p className="text-sm text-yellow-800">
                    <strong>React Error #306:</strong> Компонент пытается рендерить undefined/null.
                    Проверьте иконки, обработчики событий и данные компонентов.
                  </p>
                </div>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  Детали ошибки (только в development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  this.setState({
                    hasError: false,
                    error: null,
                    errorInfo: null
                  });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Перезагрузить страницу
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper для использования хуков
export const ErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  return <ErrorBoundaryClass fallback={fallback}>{children}</ErrorBoundaryClass>;
};
