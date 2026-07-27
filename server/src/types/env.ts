export interface WorkerBindings {
  DB: any;
  JWT_SECRET?: string;
  ADMIN_PASSWORD?: string;
  FRONTEND_ORIGINS?: string;
}

export interface WorkerVariables {
  userId: number;
  username: string;
}

export type WorkerEnv = {
  Bindings: WorkerBindings;
  Variables: WorkerVariables;
};
