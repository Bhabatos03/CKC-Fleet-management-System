'use client'

import { useState } from 'react'

const photoUrl =
  'https://images.unsplash.com/photo-1669882571612-4a9c7822cd4c?w=1800&q=85'

function Crest({ small = false }) {
  return (
    <span className={`crest ${small ? 'crest-small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path
          d="M32 2 37 10 46 7 47 17 57 20 53 29 62 35 54 42 56 52 46 54 42 62 32 57 22 62 18 54 8 52 10 42 2 35 11 29 7 20 17 17 18 7 27 10 32 2Z"
          fill="currentColor"
        />
        <path
          d="M32 12 37 17 44 17 47 24 52 29 48 36 48 43 40 46 35 52 28 48 20 48 17 40 12 35 16 28 16 21 24 18 29 12 32 12Z"
          fill="#0c0908"
        />
        <path
          d="M41 23c-2.2-2.1-5-3.2-8.2-3.2-7 0-12 5.3-12 12.4 0 7.2 5 12.2 12 12.2 3.3 0 6.2-1.2 8.4-3.5l-3.1-3.4c-1.2 1.3-2.9 2-5 2-3.8 0-6.1-2.7-6.1-6.4s2.3-6.4 6.1-6.4c2 0 3.7.7 4.9 2l3-3.4Z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function Brand({ centered = false }) {
  return (
    <div
      className={`brand ${centered ? 'brand-centered' : ''}`}
      aria-label="C. Krishniah Chetty Group of Jewellers"
    >
      <Crest small={centered} />
      <div className="brand-wordmark">
        <span>C. Krishniah Chetty.</span>
        <small>Group of Jewellers</small>
      </div>
    </div>
  )
}

function Icon({ name, size = 24 }) {
  const shapes = {
    gauge: (
      <>
        <path d="M3.2 17a9 9 0 1 1 17.6 0" />
        <path d="m12 14 4.2-5" />
        <circle cx="12" cy="15" r="1" />
        <path d="M5.2 13h1M7.7 8.8l.8.8M12 6.5v1M16.3 9.6l.8-.8M18 13h1" />
      </>
    ),
    car: (
      <>
        <path d="m4 10 1.5-4c.3-.8 1-1.3 1.9-1.3h9.2c.9 0 1.6.5 1.9 1.3l1.5 4" />
        <path d="M4 10h16a1 1 0 0 1 1 1v6H3v-6a1 1 0 0 1 1-1ZM5 17v2h3v-2m8 0v2h3v-2M6.5 13.5h2m7 0h2" />
      </>
    ),
    mileage: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M5 15c1-3 2.5-5 4.5-5 2.5 0 2.4 4 4.7 4 1.6 0 2.2-2.4 4.8-3.6M12 18l3-4" />
      </>
    ),
    fuel: (
      <>
        <path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M3 21h14M7.5 6h5v5h-5zM15 8l3 3v7a2 2 0 0 0 4 0v-5l-3-3" />
      </>
    ),
    alert: (
      <>
        <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M15 3v5h4" />
        <circle cx="11.5" cy="14" r="3.5" />
        <path d="M11.5 12v2.5m0 2h.01" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20v-2.5a6.5 6.5 0 0 1 13 0V20" />
      </>
    ),
    lock: (
      <>
        <rect x="5.5" y="10" width="13" height="11" rx="1.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3 21 21M10 7.2A10 10 0 0 1 12 7c6 0 9.5 5 9.5 5a13 13 0 0 1-3 3.1M6 8.2C3.7 9.8 2.5 12 2.5 12s3.5 5 9.5 5a10 10 0 0 0 3-.4" />
        <path d="M10.3 10.3a2.5 2.5 0 0 0 3.4 3.4" />
      </>
    ),
    arrow: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 12h9m-4-4 4 4-4 4" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  )
}

function BackgroundLayers() {
  return (
    <div className="background-layers" aria-hidden="true">
      <div
        className="background-photo"
        style={{ backgroundImage: `url("${photoUrl}")` }}
      />
      <div className="background-shade" />
      <div className="background-warmth" />

      <svg
        className="top-fabric"
        viewBox="0 0 480 180"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="top-fabric-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#2a0008" />
            <stop offset=".28" stopColor="#aa0520" />
            <stop offset=".48" stopColor="#290006" />
            <stop offset=".75" stopColor="#740213" />
            <stop offset="1" stopColor="#100003" />
          </linearGradient>
        </defs>
        <path
          fill="url(#top-fabric-gradient)"
          d="M0 0h480C331 12 185 19 103 72 59 102 36 142 0 180V0Z"
        />
      </svg>

      <svg
        className="bottom-fabric"
        viewBox="0 0 1200 170"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="bottom-fabric-gradient"
            x1="0"
            y1=".2"
            x2=".8"
            y2="1"
          >
            <stop stopColor="#1b0004" />
            <stop offset=".28" stopColor="#690013" />
            <stop offset=".52" stopColor="#9f031d" />
            <stop offset=".73" stopColor="#340007" />
            <stop offset="1" stopColor="#090407" />
          </linearGradient>
        </defs>
        <path
          fill="url(#bottom-fabric-gradient)"
          d="M0 170C205 147 258 69 473 51 655 36 791 124 954 110c103-9 194-52 246-89v149H0Z"
        />
      </svg>
    </div>
  )
}

function Header() {
  return (
    <header className="site-header">
      <div className="header-identity">
        <Brand />
        <span className="header-divider" />
        <span className="header-product">FleetPulse</span>
        <span className="header-divider short-divider" />
        <span className="header-promise">
          Smarter Fleet <i>·</i> Safer Operations <i>·</i> A Stronger CKC
        </span>
      </div>
      <span className="header-motto">
        Tradition meets tomorrow <span />
      </span>
    </header>
  )
}

const features = [
  { name: 'Vehicle Master', icon: 'car' },
  { name: 'Live Mileage', icon: 'mileage' },
  { name: 'Fuel Analytics', icon: 'fuel' },
  { name: 'Compliance Alerts', icon: 'alert' },
]

function FeatureCards() {
  const [selected, setSelected] = useState(null)

  return (
    <section className="features" aria-label="Fleet management features">
      <div className="efficiency-card">
        <div className="efficiency-icon">
          <Icon name="gauge" size={38} />
        </div>
        <div className="efficiency-copy">
          <span>Fleet efficiency</span>
          <strong>
            13.4 <small>km/L</small>
          </strong>
        </div>
        <div className="efficiency-change">
          <span>↗</span>
          <small>+12%</small>
        </div>
      </div>

      <div className="feature-grid">
        {features.map((feature) => (
          <button
            key={feature.name}
            type="button"
            className={`feature-card ${
              selected === feature.name ? 'feature-selected' : ''
            }`}
            onClick={() => setSelected(feature.name)}
            aria-pressed={selected === feature.name}
          >
            <span className="feature-icon">
              <Icon name={feature.icon} size={22} />
            </span>
            <span>{feature.name}</span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {selected
          ? `${selected} selected. Dashboard access requires sign in.`
          : ''}
      </span>
    </section>
  )
}

function HeroSection() {
  return (
    <section className="hero-section">
      <p className="hero-eyebrow">Fleet management system</p>
      <h1 className="hero-title">
        <span>Fleet</span>
        <em>Pulse</em>
        <span className="speed-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </h1>
      <h2 className="hero-statement">
        Every kilometre. Every litre.
        <br />
        <em>Accounted for.</em>
      </h2>
      <p className="hero-description">
        An intelligent platform for tracking, managing and optimizing your
        fleet – ensuring greater efficiency, safety and control for the C.
        Krishniah Chetty Group.
      </p>
      <FeatureCards />
    </section>
  )
}

function LoginCard() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setMessage('Demo preview only — sign in is not connected yet.')
  }

  return (
    <section className="login-card" aria-labelledby="login-title">
      <Brand centered />

      <div className="login-intro">
        <h2 id="login-title">Welcome Back</h2>
        <p>Sign in to access your Fleet Management System.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field">
          <Icon name="user" size={19} />
          <span className="sr-only">Username</span>
          <input
            name="username"
            type="text"
            placeholder="Enter your username"
            autoComplete="username"
            required
          />
        </label>

        <label className="login-field">
          <Icon name="lock" size={19} />
          <span className="sr-only">Password</span>
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} />
          </button>
        </label>

        <button className="login-submit" type="submit">
          Log in <Icon name="arrow" size={21} />
        </button>
        {message && (
          <p className="login-message" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-company">
        <span className="footer-dash" />
        <div>
          <span>C. Krishniah Chetty Jewellers Pvt. Ltd.</span>
          <small>FleetPulse v1.0</small>
        </div>
      </div>
      <span className="footer-motto">
        Driven by excellence <span />
      </span>
    </footer>
  )
}

export default function Page() {
  return (
    <div className="page-shell">
      <BackgroundLayers />
      <Header />
      <main className="page-main">
        <HeroSection />
        <LoginCard />
      </main>
      <Footer />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
        }

        body {
          background: #080708;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:focus-visible,
        input:focus-visible {
          outline: 2px solid #e2b77f;
          outline-offset: 3px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .page-shell {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
          overflow: hidden;
          background: #090708;
          color: #f9f5ee;
          font-family: 'DM Sans', sans-serif;
        }

        .background-layers,
        .background-layers > * {
          position: absolute;
          pointer-events: none;
        }

        .background-layers {
          inset: 0;
          z-index: -1;
          overflow: hidden;
        }

        .background-photo {
          inset: 0;
          background-size: cover;
          background-position: 50% 49%;
          transform: scaleX(-1) scale(1.04);
          filter: sepia(0.37) saturate(0.83) brightness(0.83) blur(1px);
        }

        .background-shade {
          inset: 0;
          background:
            linear-gradient(
              90deg,
              #050506 0%,
              rgba(5, 5, 6, 0.98) 21%,
              rgba(7, 6, 7, 0.91) 36%,
              rgba(12, 8, 7, 0.36) 55%,
              rgba(9, 7, 7, 0.36) 73%,
              rgba(5, 4, 5, 0.91) 100%
            ),
            linear-gradient(
              180deg,
              rgba(4, 3, 3, 0.25),
              transparent 24%,
              rgba(5, 3, 4, 0.08) 65%,
              #070507 100%
            );
        }

        .background-warmth {
          inset: 0;
          background:
            radial-gradient(
              ellipse at 66% 15%,
              rgba(230, 155, 72, 0.23),
              transparent 32%
            ),
            radial-gradient(
              ellipse at 92% 90%,
              rgba(78, 0, 13, 0.3),
              transparent 37%
            );
          mix-blend-mode: screen;
        }

        .top-fabric {
          top: 0;
          left: 0;
          width: min(33vw, 480px);
          height: 150px;
          opacity: 0.9;
        }

        .bottom-fabric {
          right: -2%;
          bottom: -3px;
          width: 75%;
          height: 155px;
          opacity: 0.72;
        }

        .site-header,
        .page-main,
        .site-footer {
          width: min(100%, 1808px);
          margin-inline: auto;
        }

        .site-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 103px;
          padding: 18px 5% 12px;
        }

        .header-identity,
        .brand,
        .header-motto,
        .footer-company,
        .footer-motto {
          display: flex;
          align-items: center;
        }

        .header-identity {
          min-width: 0;
          gap: 25px;
        }

        .brand {
          flex: none;
          gap: 11px;
          color: #f0d5a6;
          white-space: nowrap;
        }

        .crest {
          display: inline-flex;
          width: 49px;
          height: 49px;
          color: #f2d5a5;
          flex: none;
        }

        .crest svg {
          width: 100%;
          height: 100%;
        }

        .crest-small {
          width: 39px;
          height: 39px;
        }

        .brand-wordmark {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 0.9;
        }

        .brand-wordmark > span {
          font: 500 clamp(19px, 1.7vw, 29px) / 0.95
            'Cormorant Garamond', Georgia, serif;
          letter-spacing: -0.035em;
        }

        .brand-wordmark small {
          align-self: center;
          margin-top: 5px;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.37em;
          text-transform: uppercase;
        }

        .header-divider {
          width: 1px;
          height: 29px;
          background: rgba(218, 189, 147, 0.65);
          flex: none;
        }

        .short-divider {
          height: 25px;
        }

        .header-product {
          color: #d61a35;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          text-decoration: underline;
          text-underline-offset: 5px;
        }

        .header-promise {
          color: #ddd7d2;
          font-size: 13px;
          white-space: nowrap;
        }

        .header-promise i {
          padding: 0 10px;
          color: #dfc5a1;
          font-style: normal;
        }

        .header-motto,
        .footer-motto {
          gap: 14px;
          color: #ead5af;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.36em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .header-motto span,
        .footer-motto span {
          display: block;
          width: 42px;
          height: 1px;
          background: linear-gradient(90deg, #b88a55, transparent);
        }

        .page-main {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 410px);
          align-items: start;
          gap: clamp(36px, 5vw, 110px);
          flex: 1;
          padding: 27px 5% 34px;
        }

        .hero-section {
          max-width: 615px;
        }

        .hero-eyebrow {
          display: inline-block;
          margin: 0 0 9px;
          padding-bottom: 4px;
          border-bottom: 1px solid #c01532;
          color: #e5cfaa;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.31em;
          text-transform: uppercase;
        }

        .hero-title {
          display: flex;
          align-items: baseline;
          margin: 0 0 7px;
          font: 500 clamp(76px, 7.1vw, 112px) / 0.93
            'Cormorant Garamond', Georgia, serif;
          letter-spacing: -0.058em;
          white-space: nowrap;
        }

        .hero-title > span:first-child {
          color: #f2deb6;
        }

        .hero-title em {
          color: #a90022;
          font-style: normal;
        }

        .speed-lines {
          display: inline-flex;
          flex-direction: column;
          gap: 7px;
          align-self: center;
          margin-left: 14px;
          transform: translateY(13px);
        }

        .speed-lines i {
          display: block;
          width: 62px;
          height: 2px;
          background: linear-gradient(90deg, #b50729, transparent);
          transform: skewX(-25deg);
        }

        .speed-lines i:nth-child(2) {
          width: 42px;
        }

        .speed-lines i:nth-child(3) {
          width: 22px;
        }

        .hero-statement {
          margin: 0 0 11px;
          font: 400 clamp(27px, 2.6vw, 37px) / 1.04
            'Cormorant Garamond', Georgia, serif;
          letter-spacing: -0.015em;
        }

        .hero-statement em {
          color: #e6c79e;
          font-weight: 500;
        }

        .hero-description {
          max-width: 450px;
          margin: 0 0 22px;
          color: #e0deda;
          font-size: 14px;
          line-height: 1.5;
        }

        .features {
          max-width: 590px;
        }

        .efficiency-card {
          display: flex;
          align-items: center;
          width: min(100%, 386px);
          height: 87px;
          margin-bottom: 13px;
          padding: 10px 14px;
          border: 1px solid rgba(192, 120, 65, 0.85);
          border-left: 3px solid #b60b28;
          border-radius: 11px;
          background: linear-gradient(
            105deg,
            rgba(15, 8, 10, 0.8),
            rgba(0, 0, 0, 0.64)
          );
        }

        .efficiency-icon,
        .feature-icon {
          display: grid;
          flex: none;
          place-items: center;
          color: #fff4e4;
          background: linear-gradient(145deg, #b50027, #53000d 83%);
        }

        .efficiency-icon {
          width: 62px;
          height: 62px;
          margin-right: 28px;
          border-radius: 9px;
        }

        .efficiency-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .efficiency-copy > span {
          color: #eee9e4;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .efficiency-copy strong {
          font-size: 28px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
        }

        .efficiency-copy strong small {
          font-size: 25px;
          font-weight: 400;
        }

        .efficiency-change {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 12px 0 0 auto;
          color: #a9c56e;
        }

        .efficiency-change span {
          font-size: 17px;
        }

        .efficiency-change small {
          font-size: 11px;
          white-space: nowrap;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 12px;
        }

        .feature-card {
          display: flex;
          align-items: center;
          gap: 20px;
          min-width: 0;
          height: 54px;
          padding: 7px 12px;
          border: 1px solid rgba(176, 139, 105, 0.48);
          border-radius: 9px;
          background: rgba(4, 4, 5, 0.53);
          color: #f7f4f1;
          text-align: left;
          font-size: 13px;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }

        .feature-card:hover,
        .feature-selected {
          border-color: #d4a56d;
          background: rgba(48, 13, 17, 0.76);
          transform: translateY(-1px);
        }

        .feature-icon {
          width: 37px;
          height: 37px;
          border-radius: 6px;
        }

        .feature-card > svg {
          margin-left: auto;
          color: #f0c891;
          flex: none;
        }

        .login-card {
          width: 100%;
          margin-top: 15px;
          padding: 26px 28px 35px;
          border: 1px solid #d4b48a;
          border-radius: 21px;
          background: linear-gradient(
            145deg,
            rgba(38, 31, 30, 0.93),
            rgba(5, 5, 6, 0.97) 54%,
            rgba(4, 4, 5, 0.97)
          );
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.45);
        }

        .brand-centered {
          flex-direction: column;
          gap: 2px;
          justify-content: center;
        }

        .brand-centered .brand-wordmark {
          align-items: center;
        }

        .brand-centered .brand-wordmark > span {
          font-size: 25px;
        }

        .login-intro {
          margin-top: 31px;
        }

        .login-intro h2 {
          margin: 0 0 6px;
          font: 500 35px / 1 'Cormorant Garamond', Georgia, serif;
          letter-spacing: -0.03em;
        }

        .login-intro p {
          margin: 0;
          color: #e4e0dc;
          font-size: 12px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 24px;
        }

        .login-field {
          display: flex;
          align-items: center;
          gap: 14px;
          height: 50px;
          padding: 0 15px;
          border: 1px solid rgba(196, 178, 160, 0.14);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.095);
          color: #e8cb9e;
        }

        .login-field:focus-within {
          border-color: #d5aa74;
          background: rgba(255, 255, 255, 0.13);
        }

        .login-field input {
          min-width: 0;
          width: 100%;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #fff;
          font-size: 12px;
        }

        .login-field input::placeholder {
          color: #dfdcda;
          opacity: 1;
        }

        .password-toggle {
          display: grid;
          place-items: center;
          padding: 2px;
          border: 0;
          background: transparent;
          color: #e8cb9e;
        }

        .login-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 54px;
          margin-top: 2px;
          border: 1px solid #b31529;
          border-radius: 9px;
          background: linear-gradient(180deg, #b80624, #95001c);
          color: white;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .login-submit:hover {
          filter: brightness(1.2);
        }

        .login-message {
          margin: 0;
          color: #e6c69a;
          font-size: 12px;
        }

        .site-footer {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 20px;
          min-height: 70px;
          padding: 0 5% 27px;
        }

        .footer-company {
          gap: 12px;
          align-items: flex-start;
        }

        .footer-dash {
          width: 31px;
          height: 2px;
          margin-top: 5px;
          background: #d10b31;
        }

        .footer-company div {
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #d6c8bb;
          font-size: 9px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
        }

        .footer-company small {
          color: #bca682;
          font-size: 8px;
          letter-spacing: 0.35em;
        }

        .footer-motto {
          color: #d9bf93;
          font-size: 9px;
          letter-spacing: 0.26em;
        }

        .footer-motto span {
          width: 55px;
        }

        @media (max-width: 1250px) {
          .header-motto {
            display: none;
          }

          .page-main {
            gap: 30px;
            grid-template-columns: minmax(0, 1fr) minmax(340px, 390px);
          }

          .hero-title {
            font-size: clamp(66px, 7vw, 95px);
          }

          .speed-lines i {
            width: 38px;
          }

          .feature-card {
            gap: 10px;
          }
        }

        @media (max-width: 900px) {
          .site-header {
            min-height: 85px;
          }

          .header-promise,
          .short-divider {
            display: none;
          }

          .page-main {
            grid-template-columns: 1fr;
            gap: 34px;
            padding-top: 30px;
          }

          .hero-section {
            max-width: 650px;
          }

          .login-card {
            max-width: 490px;
            margin: 0 auto 20px;
          }

          .background-shade {
            background:
              linear-gradient(
                90deg,
                rgba(5, 5, 6, 0.96),
                rgba(5, 5, 6, 0.76) 52%,
                rgba(5, 5, 6, 0.82)
              ),
              linear-gradient(0deg, #050506, transparent 80%);
          }
        }

        @media (max-width: 560px) {
          .site-header {
            padding: 18px 6%;
            min-height: 78px;
          }

          .header-identity {
            gap: 14px;
          }

          .brand {
            gap: 7px;
          }

          .crest {
            width: 38px;
            height: 38px;
          }

          .brand-wordmark > span {
            font-size: 19px;
          }

          .brand-wordmark small {
            font-size: 5px;
          }

          .header-divider {
            height: 24px;
          }

          .header-product {
            font-size: 12px;
          }

          .page-main {
            padding: 35px 6% 30px;
          }

          .hero-eyebrow {
            font-size: 10px;
            letter-spacing: 0.23em;
          }

          .hero-title {
            font-size: clamp(60px, 14vw, 82px);
          }

          .speed-lines {
            gap: 5px;
            margin-left: 8px;
            transform: translateY(6px);
          }

          .speed-lines i {
            width: 23px;
          }

          .speed-lines i:nth-child(2) {
            width: 17px;
          }

          .speed-lines i:nth-child(3) {
            width: 10px;
          }

          .hero-statement {
            font-size: clamp(27px, 7vw, 34px);
          }

          .hero-description {
            font-size: 13px;
          }

          .feature-grid {
            gap: 8px;
          }

          .feature-card {
            gap: 8px;
            padding: 6px 8px;
            font-size: 11px;
          }

          .feature-icon {
            width: 32px;
            height: 32px;
          }

          .feature-card > svg {
            width: 14px;
          }

          .login-card {
            padding: 27px 22px 29px;
          }

          .site-footer {
            padding: 0 6% 22px;
          }

          .footer-motto {
            display: none;
          }

          .bottom-fabric {
            width: 120%;
            height: 110px;
          }
        }

        @media (max-width: 370px) {
          .header-divider,
          .header-product {
            display: none;
          }

          .hero-title {
            font-size: 58px;
          }

          .efficiency-icon {
            margin-right: 15px;
          }

          .feature-card {
            font-size: 10px;
          }

          .feature-icon {
            width: 28px;
            height: 28px;
          }
        }
      `}</style>
    </div>
  )
}
export default App
