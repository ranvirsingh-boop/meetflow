import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MeetingProvider } from './context/MeetingContext';
import Home from './pages/Home';
import Call from './pages/Call';

function App() {
  return (
    <MeetingProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/call/:roomId" element={<Call />} />
        </Routes>
      </Router>
    </MeetingProvider>
  );
}

export default App;
