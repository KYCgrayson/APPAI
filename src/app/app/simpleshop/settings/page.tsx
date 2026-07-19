import { requireOrganizationContext } from "@/lib/organization-context";
import { getSimpleshopSettings } from "@/lib/native-apps/service";
import { SettingsForm } from "@/components/apps/simpleshop/SettingsForm";

export default async function SimpleshopSettingsPage() {
  const context = await requireOrganizationContext();
  const { settings } = await getSimpleshopSettings(context.organizationId);

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold text-cyan-400">Organization settings</p>
        <h1 className="mt-2 text-3xl font-bold text-white">店家設定</h1>
        <p className="mt-3 text-slate-400">這些設定只屬於目前 Organization，且不接受瀏覽器指定 organizationId。</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
