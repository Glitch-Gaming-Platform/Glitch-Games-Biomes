import type {
  AuthFlowContext,
  AuthFlowState,
  ForeignAuthProvider,
  IncompleteForeignAccountProfile,
} from "@/server/shared/auth/types";
import type { WebServerApiRequest } from "@/server/web/context";
import { validateString } from "@/server/web/errors";
import { usernameOrIdToUser } from "@/server/web/util/admin";
import { safeParseBiomesId, type BiomesId } from "@/shared/ids";
import { ok } from "assert";
import type { GetServerSidePropsContext, NextApiResponse } from "next";

function checkPermitsDevAuth() {
  if (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_DEV_AUTH === "1" ||
    !!process.env.GLITCH_TITLE_ID
  ) {
    return;
  }

  ok(
    process.env.NODE_ENV !== "production",
    "Dev auth is for development only."
  );
}

export function shouldCreateNewDevAccount(username: string) {
  return username === "__new";
}

export interface DevFlowState extends AuthFlowState {
  id: BiomesId;
  username?: string;
}

export class DevProvider implements ForeignAuthProvider<DevFlowState> {
  async start(
    authContext: AuthFlowContext<DevFlowState>,
    request: WebServerApiRequest,
    response: NextApiResponse<any>
  ) {
    checkPermitsDevAuth();
    const { db, idGenerator } = request.context;

    const usernameOrId = validateString(request.query.usernameOrId);

    let id: BiomesId | undefined;
    let username: string | undefined;
    if (shouldCreateNewDevAccount(usernameOrId)) {
      id = await idGenerator.next();
    } else {
      const user = await usernameOrIdToUser(db, usernameOrId);
      id = user?.id ?? (await idGenerator.next());
      if (!user && safeParseBiomesId(usernameOrId) === undefined) {
        username = usernameOrId;
      }
    }

    response.status(200).json({
      uri: authContext.getCallbackUri({
        state: authContext.encodeState({ id, username }),
      }),
    });
  }

  async finish(
    _authContext: AuthFlowContext<DevFlowState>,
    _ctx: GetServerSidePropsContext,
    state: DevFlowState
  ): Promise<IncompleteForeignAccountProfile> {
    checkPermitsDevAuth();
    return { id: String(state.id), username: state.username };
  }
}
