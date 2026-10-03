"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const TOTAL_FRAMES = 480;
const ACTUAL_FRAME_COUNT = 480;
const WEDDING_SONG_PATH = "/audio.mp3";
const WEDDING_DESTINATION = "Hawa Mahal, Jaipur, India";
const GOOGLE_MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(WEDDING_DESTINATION)}&travelmode=driving`;
const WEDDING_EVENTS = [
  { id: "arrival", time: "10:30 AM", dateTime: "10:30", title: "Guest arrival", detail: "Welcome drinks and a warm reception." },
  { id: "ceremony", time: "11:00 AM", dateTime: "11:00", title: "Wedding ceremony", detail: "Join us for the ceremony and family blessings." },
  { id: "lunch", time: "1:00 PM", dateTime: "13:00", title: "Wedding lunch", detail: "A relaxed afternoon feast with family and friends." },
  { id: "celebration", time: "3:00 PM", dateTime: "15:00", title: "Music & celebration", detail: "Stay for music, photographs, and an afternoon together." },
];

function resolveFrameNumber(frameNumber: number) {
  return Math.min(Math.max(1, frameNumber), ACTUAL_FRAME_COUNT);
}

function getFramePath(frameNumber: number, usePortraitFrames: boolean) {
  const safeFrame = resolveFrameNumber(frameNumber);

  if (usePortraitFrames) {
    return `/portrait_frames/Couple_standing_on_balcony_overl%E2%80%A6_20261003112153_${String(safeFrame).padStart(4, "0")}.jpg`;
  }

  return `/mrg_02_frames_webp/Mughal_bride_and_groom_standing_20261002225430_${String(safeFrame).padStart(4, "0")}.webp`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);
  const loadedFramesRef = useRef<Array<HTMLImageElement | null>>([]);
  const currentFrameRef = useRef(1);
  const targetFrameRef = useRef(1);
  const portraitFramesRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const loadingRef = useRef(true);
  const retryLoadRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaderVisible, setIsLoaderVisible] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [hasWeddingSong, setHasWeddingSong] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [calendarNoteOpen, setCalendarNoteOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [lunchMenuOpen, setLunchMenuOpen] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedMotionRef.current = reducedMotion;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const scrollArea = scrollAreaRef.current;
    const portraitMedia = window.matchMedia("(max-width: 1024px), (pointer: coarse) and (max-width: 1366px)");
    let sequenceToken = 0;
    let isActive = true;

    if (!canvas || !context || !scrollArea) {
      return () => {
        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
        }
      };
    }

    const drawImageToCanvas = (image: HTMLImageElement, alpha = 1) => {
      const width = canvas.width;
      const height = canvas.height;
      const imageRatio = image.width / image.height;
      const canvasRatio = width / height;

      context.save();
      context.globalAlpha = alpha;

      if (portraitFramesRef.current && canvasRatio > imageRatio) {
        const drawWidth = height * imageRatio;
        context.drawImage(image, (width - drawWidth) / 2, 0, drawWidth, height);
      } else {
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = image.width;
        let sourceHeight = image.height;

        if (imageRatio > canvasRatio) {
          sourceWidth = image.height * canvasRatio;
          sourceX = (image.width - sourceWidth) / 2;
        } else {
          sourceHeight = image.width / canvasRatio;
          sourceY = (image.height - sourceHeight) / 2;
        }

        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      }

      context.restore();
    };

    const drawImageFrame = (frame: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const frameIndex = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(frame)));
      const actualFrameIndex = resolveFrameNumber(frameIndex);
      const image = loadedFramesRef.current[actualFrameIndex];

      if (!image || !image.complete) {
        context.clearRect(0, 0, width, height);
        return;
      }

      context.clearRect(0, 0, width, height);
      drawImageToCanvas(image);
    };

    const renderLoop = () => {
      const targetFrame = targetFrameRef.current;
      const currentFrame = currentFrameRef.current;

      if (reducedMotionRef.current) {
        currentFrameRef.current = targetFrame;
      } else {
        const delta = targetFrame - currentFrame;
        currentFrameRef.current += delta * 0.09;
      }

      const frameAsFloat = currentFrameRef.current;
      const lowerFrame = Math.max(1, Math.floor(frameAsFloat));
      const upperFrame = Math.min(TOTAL_FRAMES, lowerFrame + 1);
      const lowerImage = loadedFramesRef.current[resolveFrameNumber(lowerFrame)];
      const upperImage = loadedFramesRef.current[resolveFrameNumber(upperFrame)];
      const alpha = frameAsFloat - lowerFrame;

      if (!lowerImage && !upperImage) {
        drawImageFrame(targetFrame);
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (lowerImage && lowerImage.complete) {
          drawImageToCanvas(lowerImage);
        }

        if (upperImage && upperImage.complete && alpha > 0.001) {
          drawImageToCanvas(upperImage, alpha);
        }
      }

      rafRef.current = window.requestAnimationFrame(renderLoop);
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      drawImageFrame(currentFrameRef.current);
    };

    const updateFrameFromScroll = () => {
      if (loadingRef.current) {
        return;
      }

      const start = scrollArea.offsetTop;
      const maxScroll = Math.max(1, scrollArea.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / maxScroll));
      const nextFrame = 1 + progress * (TOTAL_FRAMES - 1);
      targetFrameRef.current = nextFrame;
    };

    const loadFrameImage = async (frameNumber: number, usePortraitFrames: boolean) => {
      let lastError: unknown;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const image = new Image();
        image.decoding = "async";

        try {
          await new Promise<void>((resolve, reject) => {
            const timeoutId = window.setTimeout(() => reject(new Error("Frame load timed out")), 15000);
            image.onload = () => {
              window.clearTimeout(timeoutId);
              resolve();
            };
            image.onerror = () => {
              window.clearTimeout(timeoutId);
              reject(new Error(`Unable to load frame ${frameNumber}`));
            };
            image.src = getFramePath(frameNumber, usePortraitFrames);

            if (image.complete && image.naturalWidth > 0) {
              window.clearTimeout(timeoutId);
              resolve();
            }
          });
          return image;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error(`Unable to decode frame ${frameNumber}`);
    };

    const loadFrameSequence = async (usePortraitFrames: boolean) => {
      const currentToken = ++sequenceToken;
      portraitFramesRef.current = usePortraitFrames;
      loadedFramesRef.current = Array(ACTUAL_FRAME_COUNT + 1).fill(null);
      loadingRef.current = true;
      setIsLoading(true);
      setIsLoaderVisible(true);
      setLoadProgress(0);
      setLoadError(false);

      try {
        const firstImage = await loadFrameImage(1, usePortraitFrames);
        if (!isActive || currentToken !== sequenceToken) {
          return;
        }

        loadedFramesRef.current[1] = firstImage;
        setLoadProgress(1);

        const batchSize = 12;
        for (let firstFrame = 2; firstFrame <= ACTUAL_FRAME_COUNT; firstFrame += batchSize) {
          const frames = Array.from(
            { length: Math.min(batchSize, ACTUAL_FRAME_COUNT - firstFrame + 1) },
            (_, index) => firstFrame + index,
          );

          await Promise.all(frames.map(async (frameNumber) => {
            const image = await loadFrameImage(frameNumber, usePortraitFrames);
            if (isActive && currentToken === sequenceToken) {
              loadedFramesRef.current[frameNumber] = image;
            }
          }));

          if (!isActive || currentToken !== sequenceToken) {
            return;
          }

          setLoadProgress(Math.round((Math.min(firstFrame + batchSize - 1, ACTUAL_FRAME_COUNT) / ACTUAL_FRAME_COUNT) * 100));
        }

        loadingRef.current = false;
        setLoadProgress(100);
        setIsLoading(false);
        updateFrameFromScroll();
      } catch {
        if (isActive && currentToken === sequenceToken) {
          setLoadError(true);
        }
      }
    };

    retryLoadRef.current = () => {
      void loadFrameSequence(portraitMedia.matches);
    };

    updateFrameFromScroll();
    resizeCanvas();
    void loadFrameSequence(portraitMedia.matches);
    rafRef.current = window.requestAnimationFrame(renderLoop);

    const onScroll = () => {
      updateFrameFromScroll();
    };

    const onResize = () => {
      if (portraitMedia.matches !== portraitFramesRef.current) {
        void loadFrameSequence(portraitMedia.matches);
      }
      resizeCanvas();
      updateFrameFromScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);

      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      isActive = false;
      sequenceToken += 1;
      retryLoadRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsLoaderVisible(false), 700);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const documentElement = document.documentElement;
    const body = document.body;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [isLoading]);

  useEffect(() => {
    let isActive = true;

    fetch(WEDDING_SONG_PATH, { method: "HEAD" })
      .then((response) => {
        if (isActive) {
          setHasWeddingSong(response.ok);
        }
      })
      .catch(() => {
        if (isActive) {
          setHasWeddingSong(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const toggleSound = async () => {
    const audio = audioRef.current;
    if (!audio || !hasWeddingSong) {
      return;
    }

    if (soundEnabled) {
      audio.pause();
      audio.currentTime = 0;
      setSoundEnabled(false);
      return;
    }

    try {
      await audio.play();
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  };

  useEffect(() => {
    const section = detailsSectionRef.current;

    if (!section) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      gsap.from(".details-heading", {
        y: 24,
        autoAlpha: 0,
        duration: 0.65,
        ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 88%", once: true },
      });

      gsap.from(".date-calendar", {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: ".date-calendar", start: "top 88%", once: true },
      });

      gsap.from(".calendar-grid tbody tr", {
        y: 8,
        autoAlpha: 0,
        duration: 0.35,
        stagger: 0.055,
        ease: "power2.out",
        scrollTrigger: { trigger: ".date-calendar", start: "top 75%", once: true },
      });

      gsap.from(".details-schedule", {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: ".details-schedule", start: "top 88%", once: true },
      });

      gsap.from(".event-row", {
        y: 12,
        autoAlpha: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: ".details-schedule", start: "top 74%", once: true },
      });

      gsap.from(".lunch-details", {
        y: 24,
        autoAlpha: 0,
        duration: 0.65,
        ease: "power3.out",
        scrollTrigger: { trigger: ".lunch-details", start: "top 90%", once: true },
      });
    }, section);

    return () => context.revert();
  }, []);

  return (
    <main className={`hero-page${isLoading ? " is-loading" : ""}`}>
      <header className="topbar" aria-label="Invitation controls">
        <button
          type="button"
          className="sound-toggle"
          aria-label={hasWeddingSong ? (soundEnabled ? "Turn sound off" : "Turn sound on") : "Add public/audio.mp3 to enable sound"}
          aria-pressed={soundEnabled}
          disabled={!hasWeddingSong}
          onClick={() => void toggleSound()}
        >
          <span className="sound-icon" aria-hidden="true">&#9834;</span>
          <span>{soundEnabled ? "SOUND ON" : "SOUND OFF"}</span>
        </button>
      </header>
      <audio
        ref={audioRef}
        src={WEDDING_SONG_PATH}
        loop
        preload="none"
        onError={() => {
          setHasWeddingSong(false);
          setSoundEnabled(false);
        }}
      />
      {isLoaderVisible && (
        <div className={`invitation-loader${isLoading ? "" : " is-exiting"}`} aria-hidden={!isLoading}>
          <div className="invitation-loader-content" aria-live="polite">
            <p className="loader-kicker">THE GOLDEN UNION</p>
            <h2>{loadError ? "A little more time" : "Your invitation is almost ready"}</h2>
            <div
              className="loader-progress"
              role="progressbar"
              aria-label="Loading invitation images"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadProgress}
            >
              <span style={{ width: `${loadProgress}%` }} />
            </div>
            <p className="loader-status">
              {loadError ? "Some images couldn&apos;t be loaded." : `${loadProgress}%`}
            </p>
            {loadError && (
              <button type="button" className="loader-retry" onClick={() => retryLoadRef.current?.()}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      <div ref={scrollAreaRef} className="hero-scroll-area">
        <div className="hero-canvas-shell">
          <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
          <div className="hero-overlay" aria-label="Wedding invitation overlay">
            <aside className="vertical-nav" aria-label="Section navigation">
              <a href="#wedding-date">DATE</a>
              <span className="divider" />
              <a href="#wedding-destination">DESTINATION</a>
            </aside>

            <div className="hero-copy">
              <p className="eyebrow">WE INVITE YOU TO CELEBRATE THE WEDDING OF</p>
              <h1 className="hero-title">
                <span>Rahul</span>
                <span className="name-ampersand">&amp;</span>
                <span>Nandini</span>
              </h1>
              <p className="subtitle">JOIN US FOR A DAY OF LOVE AND CELEBRATION</p>
            </div>
          </div>
        </div>
      </div>

      <section ref={detailsSectionRef} className="details-section" aria-labelledby="details-title">
        <div className="details-content">
          <div className="details-heading">
            <p className="details-label">WEDDING DETAILS</p>
            <h2 id="details-title">Save the date</h2>
          </div>

          <div className="details-main-grid">
            <div className="details-date" id="wedding-date">
              <div className="date-calendar">
                <div className="calendar-heading">
                  <div>
                    <p className="calendar-kicker">WEDDING DAY</p>
                    <h3>October <span>2026</span></h3>
                  </div>
                  <time className="calendar-selected-date" dateTime="2026-10-25" aria-label="Sunday, October 25, 2026">
                    <span>SUN</span>
                    <strong>25</strong>
                  </time>
                </div>

                <table className="calendar-grid" aria-label="October 2026 calendar">
                  <thead>
                    <tr>
                      <th scope="col">Sun</th>
                      <th scope="col">Mon</th>
                      <th scope="col">Tue</th>
                      <th scope="col">Wed</th>
                      <th scope="col">Thu</th>
                      <th scope="col">Fri</th>
                      <th scope="col">Sat</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td aria-hidden="true" />
                      <td aria-hidden="true" />
                      <td aria-hidden="true" />
                      <td aria-hidden="true" />
                      <td><time dateTime="2026-10-01">1</time></td>
                      <td><time dateTime="2026-10-02">2</time></td>
                      <td><time dateTime="2026-10-03">3</time></td>
                    </tr>
                    <tr>
                      <td><time dateTime="2026-10-04">4</time></td>
                      <td><time dateTime="2026-10-05">5</time></td>
                      <td><time dateTime="2026-10-06">6</time></td>
                      <td><time dateTime="2026-10-07">7</time></td>
                      <td><time dateTime="2026-10-08">8</time></td>
                      <td><time dateTime="2026-10-09">9</time></td>
                      <td><time dateTime="2026-10-10">10</time></td>
                    </tr>
                    <tr>
                      <td><time dateTime="2026-10-11">11</time></td>
                      <td><time dateTime="2026-10-12">12</time></td>
                      <td><time dateTime="2026-10-13">13</time></td>
                      <td><time dateTime="2026-10-14">14</time></td>
                      <td><time dateTime="2026-10-15">15</time></td>
                      <td><time dateTime="2026-10-16">16</time></td>
                      <td><time dateTime="2026-10-17">17</time></td>
                    </tr>
                    <tr>
                      <td><time dateTime="2026-10-18">18</time></td>
                      <td><time dateTime="2026-10-19">19</time></td>
                      <td><time dateTime="2026-10-20">20</time></td>
                      <td><time dateTime="2026-10-21">21</time></td>
                      <td><time dateTime="2026-10-22">22</time></td>
                      <td><time dateTime="2026-10-23">23</time></td>
                      <td><time dateTime="2026-10-24">24</time></td>
                    </tr>
                    <tr>
                      <td className="wedding-day">
                        <button
                          type="button"
                          className="calendar-day-button"
                          aria-label="Toggle wedding day details for October 25"
                          aria-expanded={calendarNoteOpen}
                          aria-controls="calendar-day-note"
                          onClick={() => setCalendarNoteOpen((isOpen) => !isOpen)}
                        >
                          25
                        </button>
                      </td>
                      <td><time dateTime="2026-10-26">26</time></td>
                      <td><time dateTime="2026-10-27">27</time></td>
                      <td><time dateTime="2026-10-28">28</time></td>
                      <td><time dateTime="2026-10-29">29</time></td>
                      <td><time dateTime="2026-10-30">30</time></td>
                      <td><time dateTime="2026-10-31">31</time></td>
                    </tr>
                  </tbody>
                </table>
                <p id="calendar-day-note" className={`calendar-day-note${calendarNoteOpen ? " is-open" : ""}`}>
                  Sunday wedding day · Ceremony begins at 11:00 AM.
                </p>
              </div>
            </div>

            <div className="details-schedule">
              <p className="details-label">SUNDAY, 25 OCTOBER</p>
              <h3>Wedding day schedule</h3>
              {WEDDING_EVENTS.map((event) => {
                const isOpen = activeEventId === event.id;

                return (
                  <div
                    key={event.id}
                    className={`event-row${isOpen ? " is-open" : ""}`}
                  >
                    <time className="event-time" dateTime={event.dateTime}>{event.time}</time>
                    <div>
                      <h4>
                        <button
                          type="button"
                          className="event-toggle"
                          aria-expanded={isOpen}
                          aria-controls={`event-detail-${event.id}`}
                          onClick={() => setActiveEventId(isOpen ? null : event.id)}
                        >
                          <span>{event.title}</span>
                          <span className="event-toggle-mark" aria-hidden="true">{isOpen ? "-" : "+"}</span>
                        </button>
                      </h4>
                      <p id={`event-detail-${event.id}`} className="event-description">{event.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`lunch-details${lunchMenuOpen ? " is-open" : ""}`}>
            <div>
              <p className="details-label">1:00 PM · WEDDING LUNCH</p>
              <h3>A royal Indian feast</h3>
              <button
                type="button"
                className="lunch-menu-toggle"
                aria-expanded={lunchMenuOpen}
                aria-controls="lunch-menu"
                onClick={() => setLunchMenuOpen((isOpen) => !isOpen)}
              >
                {lunchMenuOpen ? "Close menu" : "View lunch menu"}
                <span aria-hidden="true">{lunchMenuOpen ? "-" : "+"}</span>
              </button>
            </div>
            <div className="lunch-menu" id="lunch-menu">
              <p><span>WELCOME DRINK</span> Rose &amp; saffron sharbat</p>
              <p><span>FROM THE KITCHEN</span> Paneer lababdar, dal makhani, seasonal vegetables, basmati rice &amp; naan</p>
              <p><span>SWEET FINISH</span> Gulab jamun &amp; kulfi</p>
            </div>
          </div>
        </div>
      </section>

      <section className="destination-section" id="wedding-destination" aria-labelledby="destination-title">
        <div className="destination-content">
          <div className="destination-map">
            <iframe
              title={`Map showing ${WEDDING_DESTINATION}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(WEDDING_DESTINATION)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="destination-invitation">
            <p className="destination-kicker">A PLACE TO GATHER</p>
            <h2 id="destination-title">We&apos;d be so glad to see you.</h2>
            <p className="destination-message">
              Your presence would make our day even more special. Come celebrate with us at the beautiful Hawa Mahal,
              and let&apos;s make a memory to treasure.
            </p>

            <div className="destination-address">
              <span className="destination-mark" aria-hidden="true">*</span>
              <div>
                <p>OUR DESTINATION</p>
                <h3>Hawa Mahal</h3>
                <span>Jaipur, Rajasthan, India</span>
              </div>
            </div>

            <a
              className="destination-directions"
              href={GOOGLE_MAPS_DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Get directions to ${WEDDING_DESTINATION} in Google Maps`}
            >
              <span>Get directions</span>
              <span aria-hidden="true">&#8599;</span>
            </a>
            <p className="destination-footnote">We can&apos;t wait to celebrate with you.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
