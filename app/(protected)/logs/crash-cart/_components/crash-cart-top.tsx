"use client";

import { UserPen } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TOP_OF_CART_ITEMS } from "@/lib/validations/log-entry";
import { SignatureCell } from "../../narcotic/_components/signature-cell";
import { useMySignature } from "@/hooks/use-my-signature";
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
  const { profile: myProfile } = useMySignature();
  // -- Toggle a top-of-cart checkbox -----------------------------------------

  function toggleItem(key: string) {
    const current = !!data.top_of_cart[key];
    onChange({
      ...data,
      top_of_cart: { ...data.top_of_cart, [key]: !current },
    });
  }

  // -- Update a signature entry ----------------------------------------------

  function updateSignatureFields(
    index: number,
    fields: Partial<{ name: string; signature: string | null; initials: string }>,
  ) {
    const next = [...data.signatures];
    next[index] = { ...next[index], ...fields };
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
                    {/* Name cell — editable input when empty, read-only span when filled; UserPen to apply profile */}
                    <td className={CELL}>
                      <div className="flex items-center gap-1">
                        {data.signatures[idx]?.name && !disabled ? (
                          <span
                            className="flex-1 truncate text-xs leading-7 min-w-0 cursor-default px-0.5"
                            title={data.signatures[idx].name}
                          >
                            {data.signatures[idx].name}
                          </span>
                        ) : (
                          <Input
                            type="text"
                            value={data.signatures[idx]?.name ?? ""}
                            onChange={(e) =>
                              updateSignatureFields(idx, { name: e.target.value })
                            }
                            disabled={disabled}
                            placeholder="Name"
                            className="h-7 flex-1 min-w-0 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        )}
                        {myProfile && !disabled && (
                          <button
                            type="button"
                            title="Apply my name & initials"
                            onClick={() =>
                              updateSignatureFields(idx, {
                                name: myProfile.name,
                                initials: myProfile.default_initials ?? "",
                              })
                            }
                            className="shrink-0 flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                            tabIndex={-1}
                          >
                            <UserPen className="size-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={CELL}>
                      <SignatureCell
                        value={data.signatures[idx]?.signature ?? null}
                        onChange={(_storagePath, base64) =>
                          updateSignatureFields(idx, { signature: base64 })
                        }
                        locationId={locationId}
                        disabled={disabled}
                        defaultSignerName={myProfile?.name}
                        hideSignerName
                        onNameChange={(name) => {
                          if (name) {
                            updateSignatureFields(idx, {
                              name,
                              initials: myProfile?.default_initials ?? "",
                            });
                          } else {
                            updateSignatureFields(idx, { name: "", initials: "" });
                          }
                        }}
                      />
                    </td>
                    {/* Initials cell — editable input when empty, read-only span when filled */}
                    <td className={CELL}>
                      {data.signatures[idx]?.initials && !disabled ? (
                        <span className="block w-full text-center text-xs leading-7 cursor-default">
                          {data.signatures[idx].initials}
                        </span>
                      ) : (
                        <Input
                          type="text"
                          value={data.signatures[idx]?.initials ?? ""}
                          onChange={(e) =>
                            updateSignatureFields(idx, { initials: e.target.value })
                          }
                          disabled={disabled}
                          maxLength={5}
                          placeholder="Init."
                          className="h-7 w-full text-xs text-center border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      )}
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
