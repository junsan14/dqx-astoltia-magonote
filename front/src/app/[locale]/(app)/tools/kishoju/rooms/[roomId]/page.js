import KishojuRoomClient from "./KishojuRoomClient";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function KishojuRoomPage({ params }) {
  return (
    <KishojuRoomClient
      locale={params.locale}
      roomId={params.roomId}
    />
  );
}