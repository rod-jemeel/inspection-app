"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TOP_OF_CART_ITEMS } from "@/lib/validations/log-entry";
import { SignatureCell } from "../../narcotic/_components/signature-cell";
import { cn } from "@/lib/utils";
import type { CrashCartLogData } from "@/lib/validations/log-entry";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CrashCartTopProps {
  data: CrashCartLogData;
  onChange: (data: CrashCartLogData) => void;
  locationId: string;
  disabled?: boolean;
  isDraft?: boolean;
}

// ---------------------------------------------------------------------------
// Shared cell style constants (matches crash-cart-table.tsx)
// ---------------------------------------------------------------------------

const B = "border border-foreground/25";
const HDR = `${B} bg-muted/30 px-2 py-1.5 text-xs font-semibold text-center`;
const CELL = `${B} px-1.5 py-1.5`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrashCartTop({
  data,
  onChange,
  locationId,
  disabled,
  isDraft,
}: CrashCartTopProps) {
  // -- Toggle a top-of-cart checkbox -----------------------------------------

  function toggleItem(key: string) {
    const current = !!data.top_of_cart[key];
    onChange({
      ...data,
      top_of_cart: { ...data.top_of_cart, [key]: !current },
    });
  }

  // -- Update a signature entry ----------------------------------------------

  function updateSignature(
    index: number,
    field: "name" | "signature" | "initials",
    value: string | null,
  ) {
    const next = [...data.signatures];
    next[index] = { ...next[index], [field]: value ?? "" };
    onChange({ ...data, signatures: next });
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div>
      {/* Checklist with header */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(HDR, "text-sm font-bold")} colSpan={2}>
              TOP OF CRASH CART
            </th>
          </tr>
        </thead>
        <tbody>
          {TOP_OF_CART_ITEMS.map((item) => (
            <tr key={item.key} className="hover:bg-muted/10">
              <td
                className={cn(
                  CELL,
                  "w-10 text-center",
                  isDraft && data.top_of_cart[item.key] && "bg-yellow-50",
                )}
              >
                <Checkbox
                  checked={!!data.top_of_cart[item.key]}
                  onCheckedChange={() => toggleItem(item.key)}
                  disabled={disabled}
                />
              </td>
              <td className={cn(CELL, "pl-2 text-xs")}>{item.label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signature section - responsive grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((half) => (
          <table key={half} className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(HDR, "w-8")}>#</th>
                <th className={HDR}>Name</th>
                <th className={cn(HDR, "w-[140px] xl:w-[200px]")}>Signature</th>
                <th className={cn(HDR, "w-[70px]")}>Initials</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((rowIdx) => {
                const idx = half * 3 + rowIdx;
                return (
                  <tr key={idx}>
                    <td className={cn(CELL, "text-center text-xs font-medium")}>
                      {idx + 1}
                    </td>
                    <td className={CELL}>
                      <Input
                        type="text"
                        value={data.signatures[idx]?.name ?? ""}
                        onChange={(e) =>
                          updateSignature(idx, "name", e.target.value)
                        }
                        disabled={disabled}
                        aria-label={`Signature ${idx + 1} name`}
                        className="h-8 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Name"
                      />
                    </td>
                    <td className={CELL}>
                      <SignatureCell
                        value={data.signatures[idx]?.signature ?? null}
                        onChange={(_storagePath, base64) =>
                          updateSignature(idx, "signature", base64)
                        }
                        locationId={locationId}
                        disabled={disabled}
                      />
                    </td>
                    <td className={CELL}>
                      <Input
                        type="text"
                        value={data.signatures[idx]?.initials ?? ""}
                        onChange={(e) =>
                          updateSignature(idx, "initials", e.target.value)
                        }
                        disabled={disabled}
                        aria-label={`Signature ${idx + 1} initials`}
                        className="h-8 w-full border-0 bg-transparent text-center text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Init."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
