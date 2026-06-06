import React from 'react'
import { cn } from '../lib/utils'

/**
 * Button Component
 * مكون الزر مع دعم كامل لإمكانية الوصول
 */
const Button = React.forwardRef(({
  className,
  variant = "default",
  size = "default",
  loading = false,
  ariaLabel,
  disabled,
  children,
  ...props
}, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
    gradient: "gradient-primary text-white hover:opacity-90",
    gradientPrimary: "gradient-primary text-white hover:opacity-90",
    gradientSecondary: "gradient-secondary text-white hover:opacity-90"
  }

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  }

  const isDisabled = disabled || loading

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 touch-manipulation select-none",
        variants[variant] || variants.default,
        sizes[size],
        loading && "cursor-wait",
        className
      )}
      ref={ref}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="sr-only">جارٍ التحميل</span>
          {children}
        </>
      ) : children}
    </button>
  )
})

Button.displayName = "Button"

export { Button }
export default Button