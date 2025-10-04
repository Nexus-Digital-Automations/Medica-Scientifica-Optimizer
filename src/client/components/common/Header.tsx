export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">🏭</span>
              <span>Medica Scientifica</span>
            </h1>
            <p className="text-gray-600 text-sm mt-1 ml-12">
              Production Strategy Simulator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-600 font-medium">Simulation Period</p>
              <p className="text-base font-semibold text-gray-900 mt-0.5">Day 51 - Day 500</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
