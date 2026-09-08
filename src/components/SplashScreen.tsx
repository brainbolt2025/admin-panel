import AsineLogo from './AsineLogo'

interface SplashScreenProps {
  caption?: string
}

const SplashScreen = ({ caption }: SplashScreenProps) => {
  return (
    <div className="bg-asine-hero-map relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="mb-8 animate-[fadeIn_0.4s_ease-out] rounded-2xl bg-white/95 px-6 py-4 shadow-lg">
          <AsineLogo size="login" src="/asine-logo.png" />
        </div>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300"
          aria-hidden="true"
        />
        {caption ? (
          <p className="mt-5 text-sm font-medium text-emerald-100/80">{caption}</p>
        ) : (
          <p className="sr-only">Loading</p>
        )}
      </div>
    </div>
  )
}

export default SplashScreen
