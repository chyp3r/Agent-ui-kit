import { useEffect } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

/** A couple of pixels of slack: a fractional scrollTop is not "not at the end". */
const SLACK = 2;

/**
 * The quiet that separates one flick from the next.
 *
 * A trackpad sends wheel events for a second or more after the fingers have
 * left, and every one of them still reports the same deltaY against the same
 * end. Without a gap to tell gestures apart, one flick bounced the column over
 * and over.
 */
const GESTURE_GAP_MS = 180;

/** Backstop for the class, in case the animation never reports its own end. */
const SETTLE_MS = 560;

/**
 * The transcript pushes back when it has nowhere left to go.
 *
 * A scroller inside the page has no elastic overscroll of its own — the
 * rubber-band people know belongs to the document, and the document here does
 * not scroll. So a wheel that asks for text which is not there gets an answer:
 * the column leans a few pixels that way and springs back, once per gesture.
 *
 * It renders nothing. It lives inside the scroller because that is where the
 * library hands out the elements (`scrollRef`, `contentRef`).
 */
export function ScrollEdges() {
  const { scrollRef, contentRef } = useStickToBottomContext();

  useEffect(() => {
    const element = scrollRef.current;
    const content = contentRef.current;
    if (!element || !content) return;

    let lastWheel = 0;
    let armed = true;
    let backstop = 0;

    const stop = () => {
      content.removeAttribute("data-bounce");
      window.clearTimeout(backstop);
      backstop = 0;
    };

    const onAnimationEnd = (event: AnimationEvent) => {
      // Everything animating inside the transcript bubbles its end up to here:
      // an answer settling into place, a cited cell pulsing. Only this
      // element's own animation is this handler's business — acting on a
      // descendant's cleared the class mid-spring and let the next wheel event
      // start it over.
      if (event.target === content) stop();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.timeStamp - lastWheel > GESTURE_GAP_MS) armed = true;
      lastWheel = event.timeStamp;
      if (!armed) return;

      const travel = element.scrollHeight - element.clientHeight;
      // Nothing to scroll at all: the transcript is not against an end, it has
      // no ends, and a column that springs when it is simply short reads broken.
      if (travel <= SLACK) return;

      const edge =
        event.deltaY < 0 && element.scrollTop <= SLACK
          ? "top"
          : event.deltaY > 0 && travel - element.scrollTop <= SLACK
            ? "bottom"
            : null;
      if (!edge) return;

      armed = false;
      stop();
      // The class has to be off the element before it goes back on, or the
      // animation is never restarted for a second flick at the same end.
      void content.offsetWidth;
      content.setAttribute("data-bounce", edge);
      backstop = window.setTimeout(stop, SETTLE_MS);
    };

    element.addEventListener("wheel", onWheel, { passive: true });
    content.addEventListener("animationend", onAnimationEnd);

    return () => {
      element.removeEventListener("wheel", onWheel);
      content.removeEventListener("animationend", onAnimationEnd);
      window.clearTimeout(backstop);
      content.removeAttribute("data-bounce");
    };
  }, [scrollRef, contentRef]);

  return null;
}
