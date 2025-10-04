export default function Header() {
  return (
    <header className="relative bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 border-b border-blue-700/30 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
      <div className="container mx-auto px-6 py-6 relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              🏭 Medica Scientifica
            </h1>
            <p className="text-blue-200/80 text-base mt-2 font-medium">
              Production Strategy Simulator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-900/30 backdrop-blur-sm rounded-lg px-4 py-3 border border-blue-700/50">
              <p className="text-xs text-blue-300 font-medium">Simulation Period</p>
              <p className="text-base font-bold text-white mt-1">Day 51 - Day 500</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
