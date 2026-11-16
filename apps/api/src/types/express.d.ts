import type { GroupRole, User } from "@prisma/client";
import type { AccessClaims } from "../lib/tokens.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessClaims;
      currentUser?: User;
      membership?: { groupId: string; role: GroupRole };
    }
  }
}

export {};
