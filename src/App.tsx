import { Routes, Route } from 'react-router-dom';
import WelcomeContent from '../components/WelcomeContent';
import PlayContent from '../components/PlayContent';
import ResultsContent from '../components/ResultsContent';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={
        <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-stone-950">
          <WelcomeContent />
        </main>
      } />
      <Route path="/play" element={<PlayContent />} />
      <Route path="/results" element={<ResultsContent />} />
    </Routes>
  );
}
