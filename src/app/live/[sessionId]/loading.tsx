export default function LiveLoading() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-red-600/50 text-sm tracking-widest uppercase animate-pulse">
        Connexion au live...
      </div>
    </div>
  );
}
