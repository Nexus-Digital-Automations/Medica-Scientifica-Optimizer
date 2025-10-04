export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xl">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="text-5xl">🏭</span>
              <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Medica Scientifica
              </span>
            </h1>
            <p className="text-blue-100 text-base mt-2 ml-16 font-medium">
              Production Strategy Simulator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl px-6 py-3 border border-white/30 shadow-xl">
              <p className="text-xs text-white/80 font-semibold tracking-wider uppercase">Simulation Period</p>
              <p className="text-lg font-black text-white mt-1">Day 51 - Day 500</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
