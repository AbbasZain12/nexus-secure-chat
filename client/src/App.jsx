import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import ChatDashboard from './pages/ChatDashboard';

// Custom wrapper to protect the chat route
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('nexus_token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <BrowserRouter>
      <main className="antialiased">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute>
                <ChatDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;