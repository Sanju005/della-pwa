import { getProfileOverviewData } from "@/lib/profile-service";

import { WalletTopUpScreen } from "../_components/profile-ui";

export default async function ProfileWalletPage() {
  const data = await getProfileOverviewData();
  return <WalletTopUpScreen initialData={data} />;
}
