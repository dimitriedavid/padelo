import { createAppDependencies, type AppDependencies } from "./app.js";
import { PostgresTournamentRepository } from "./repositories/postgres-tournament-repository.js";
import { TournamentService } from "./services/tournament-service.js";

export function createProductionDependencies(): AppDependencies {
  return createAppDependencies({
    tournamentService: new TournamentService({
      repository: new PostgresTournamentRepository(),
    }),
  });
}

