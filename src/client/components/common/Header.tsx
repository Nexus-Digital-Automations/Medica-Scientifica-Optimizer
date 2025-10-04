export default function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              🏭 Medica Scientifica
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Production Strategy Simulator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">Simulation Period</p>
              <p className="text-sm font-semibold text-white">Day 51 - Day 500</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
