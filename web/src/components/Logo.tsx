import { mdiBookOpenPageVariant } from "@mdi/js";

/** The mark: an open ledger on a rounded square in the primary colour. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="hk-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" />
      <path transform="translate(4 4)" d={mdiBookOpenPageVariant} />
    </svg>
  );
}
