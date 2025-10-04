export default function Header() {
  return (
    <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
      <div className="container mx-auto px-8 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-black text-white tracking-tight flex items-center gap-4">
              <span className="text-6xl drop-shadow-lg">🏭</span>
              <span className="drop-shadow-lg">
                Medica Scientifica
              </span>
            </h1>
            <p className="text-white text-xl mt-3 ml-20 font-bold drop-shadow-md">
              Production Strategy Simulator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-xl rounded-3xl px-8 py-5 shadow-2xl border-2 border-white/30">
              <p className="text-sm text-white font-black tracking-wider uppercase">Simulation Period</p>
              <p className="text-3xl font-black text-white mt-2">Day 51 - Day 500</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
