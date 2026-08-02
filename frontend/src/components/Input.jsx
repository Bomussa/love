import React from 'react'
import { cn } from '../lib/utils'

/**
 * Input Component
 * مكون الإدخال مع دعم كامل لإمكانية الوصول
 *
 * Pattern validation is intentionally handled by application validators so the
 * user receives the correct Arabic/English message instead of a browser-native
 * message that varies by browser and device locale.
 */
const Input = React.forwardRef(({
  className,
  type = "text",
  pattern,
  label,
  error,
  hint,
  required,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 mr-1" aria-hidden="true">*</span>}
        </label>
      )}

      <input
        id={inputId}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-red-500 focus-visible:ring-red-500" : "border-input",
          className
        )}
        ref={ref}
        data-validation-pattern={pattern || undefined}
        required={required}
        aria-required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = "Input"

export { Input }
export default Input
