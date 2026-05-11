import RouteProgressDoneOnRender from "@/components/common/route-progress/RouteProgressDoneOnRender";

export default function Template({ children }) {
  return (
    <>
      {children}
      <RouteProgressDoneOnRender />
    </>
  );
}