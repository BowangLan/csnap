import { Link } from '@tanstack/react-router'

export const NAVBAR_HEIGHT = 56;

function SidebarTitleBar() {
  return (
    <div
      id="sidebar-title-bar"
      className="flex-none flex flex-row items-center"
      style={{
        height: NAVBAR_HEIGHT,
      }}
    >
    </div>
  );
}

export default function Navbar() {
  return (
    <div
      id="navbar"
      className="flex-none w-full flex flex-row items-center gap-4"
      style={{
        height: NAVBAR_HEIGHT,
        paddingLeft: 72,
      }}
    >
      <SidebarTitleBar />
      <div className="flex gap-4">
        <Link
          to="/"
          className="text-white/70 hover:text-white transition-colors [&.active]:text-white [&.active]:font-semibold"
        >
          Home
        </Link>
        <Link
          to="/about"
          className="text-white/70 hover:text-white transition-colors [&.active]:text-white [&.active]:font-semibold"
        >
          About
        </Link>
      </div>
    </div>
  );
}
