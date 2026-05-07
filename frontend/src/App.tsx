import { Navigate, Route, Routes } from "react-router-dom";

import { FinishedTournamentPage } from "./pages/FinishedTournamentPage";
import { HomePage } from "./pages/HomePage";
import { NewTournamentPage } from "./pages/NewTournamentPage";
import { TournamentRoomPage } from "./pages/TournamentRoomPage";

export function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<NewTournamentPage />} path="/new" />
      <Route element={<TournamentRoomPage />} path="/t/:roomCode" />
      <Route element={<FinishedTournamentPage />} path="/t/:roomCode/done" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}

