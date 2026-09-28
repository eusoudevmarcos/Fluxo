import { InviteLandingClient } from "./InviteLandingClient";

type InvitePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;

  return <InviteLandingClient code={code} />;
}
