import * as React from "react"
import { cn } from "@/lib/utils"
import { inputCls } from "@/lib/ui"

/** Label + text input used across settings/auth forms. */
export function Field({
  label,
  name,
  className,
  ...inputProps
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        autoComplete="off"
        className={cn(inputCls, className)}
        {...inputProps}
      />
    </div>
  )
}
