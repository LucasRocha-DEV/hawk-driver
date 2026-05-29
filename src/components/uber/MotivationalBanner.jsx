// MotivationalBanner — faixa de frases rotativas com fade
export default function MotivationalBanner({ frase, visivel }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-hawk-green/15 bg-hawk-green/5 px-5 py-3.5 text-center">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -left-10 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-hawk-green/10 blur-2xl" />

      <p
        className="relative z-10 text-sm font-medium text-hawk-green transition-opacity duration-400"
        style={{ opacity: visivel ? 1 : 0 }}
      >
        {frase}
      </p>
    </div>
  );
}
