import { DialogButton } from "@/client/components/system/DialogButton";
import { MaybeError, useError } from "@/client/components/system/MaybeError";
import { checkLoggedIn, logout } from "@/client/util/auth";
import {
  clearAuthCookies,
  verifyAuthenticatedRequest,
} from "@/server/shared/auth/cookies";
import type { WebServerServerSidePropsContext } from "@/server/web/context";
import { findByUID } from "@/server/web/db/users_fetch";
import { reportFunnelStage } from "@/shared/funnel";
import type { BiomesId } from "@/shared/ids";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

const LoginFlowController = dynamic(
  () => import("@/client/components/login/LoginFlowController"),
  {
    loading: () => (
      <div className="biomes-box dialog login-flow">
        <div className="dialog-contents">Loading...</div>
      </div>
    ),
    ssr: false,
  }
);

function LogOutFromBiomes() {
  const [disabled, setDisabled] = useState(false);
  return (
    <div className="w-24">
      <DialogButton
        disabled={disabled}
        extraClassNames="w-full"
        onClick={async () => {
          setDisabled(true);
          await logout();
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }}
        type="destructive"
      >
        Log Out
      </DialogButton>
    </div>
  );
}

const DEFAULT_LOGIN_REDIRECT = "/at";

function LoginToBiomes() {
  const router = useRouter();
  const redirectPath =
    typeof router.query.redirect === "string"
      ? router.query.redirect
      : DEFAULT_LOGIN_REDIRECT;
  const [error, setError] = useError();

  const navigateIfLoggedIn = useCallback(async () => {
    setTimeout(() => {
      void checkLoggedIn().then((userId) => {
        if (userId) {
          window.location.href = redirectPath;
        } else {
          setError("Error logging in, try refreshing");
        }
      });
    }, 1000);
  }, [redirectPath, setError]);

  return (
    <>
      <MaybeError error={error} />
      <LoginFlowController
        onCancel={() => {}}
        onLogin={navigateIfLoggedIn}
        onCreate={navigateIfLoggedIn}
        devOnly={true}
      />
    </>
  );
}

export default function Login({
  authedUserId,
}: {
  authedUserId: BiomesId | null;
}) {
  const router = useRouter();
  const redirectPath =
    typeof router.query.redirect === "string"
      ? router.query.redirect
      : DEFAULT_LOGIN_REDIRECT;

  useEffect(() => {
    if (authedUserId) {
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 1000);
    }
  }, [authedUserId, redirectPath]);

  useEffect(() => reportFunnelStage("clickedLoginLink"), []);
  return (
    <div className="login-page">
      {authedUserId ? (
        <>
          <h1>You are already logged in</h1>
          <LogOutFromBiomes />
        </>
      ) : (
        <>
          <LoginToBiomes />
        </>
      )}
    </div>
  );
}

export async function getServerSideProps(
  context: WebServerServerSidePropsContext
) {
  const token = await verifyAuthenticatedRequest(
    context.req.context.sessionStore,
    context.req
  );

  if (!token.error && token.auth.userId) {
    const user = await findByUID(context.req.context.db, token.auth.userId);
    if (user) {
      return {
        redirect: {
          permanent: false,
          destination:
            context.query?.redirect && typeof context.query.redirect === "string"
              ? context.query.redirect
              : DEFAULT_LOGIN_REDIRECT,
        },
      };
    }

    if (process.env.NODE_ENV !== "production") {
      clearAuthCookies(context.res);
    }
  }

  return {
    props: {
      authedUserId: null,
    },
  };
}
