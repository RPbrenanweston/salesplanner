import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionView } from './components/ExecutionView';
import { IntelligenceView } from './components/IntelligenceView';

const queryClient = new QueryClient();

/**
 * Main application component
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <header>
            <h1>Sourcing Mission Control</h1>
            <nav>
              <Link to="/">Execute</Link>
              {' | '}
              <Link to="/intelligence">Intelligence</Link>
            </nav>
          </header>

          <main>
            <Routes>
              <Route path="/" element={
                <ExecutionView
                  keywords={['senior engineer', 'React', 'TypeScript']}
                  rssFeedUrls={['https://example.com/feed.xml']}
                  filters={{
                    minimumConfidence: 80,
                    signalTypes: ['HIRING', 'COMPANY', 'INDIVIDUAL']
                  }}
                />
              } />
              <Route path="/intelligence" element={<IntelligenceView />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
