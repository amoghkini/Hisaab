/*
 * The artwork beside the login and sign-up forms. Ported from ezBookkeeping's AuthIllustration.vue
 * (Copyright (c) 2020-2026 MaysWind, MIT License; see THIRD_PARTY_NOTICES.md). Its colours come from
 * the .auth-illustration__* classes in styles.css, so it follows the theme.
 */

const PAGE =
  "M176 216H350C354 216 357 218 360 221C363 218 366 216 370 216H544C550 216 554 220 554 226V474C554 480 550 484 544 484H370C366 484 363 486 360 489C357 486 354 484 350 484H176C170 484 166 480 166 474V226C166 220 170 216 176 216Z";

const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

function LoginScene() {
  return (
    <g className="auth-illustration__scene">
      <rect className="auth-illustration__backdrop" x="110" y="159" width="500" height="384" rx="138" transform="rotate(-8 360 352)" />

      <g className="auth-illustration__shadow" transform="rotate(-4 360 353)">
        <g transform="rotate(7 506 224)">
          <path
            className="auth-illustration__paper"
            d="M479 170H531C536 170 540 174 540 179V271L532 266L524 271L516 266L508 271L500 266L492 271L484 266L476 271V179C476 174 477 170 479 170Z"
          />
          <rect className="auth-illustration__accent" x="490" y="186" width="24" height="4" rx="2" />
          <rect className="auth-illustration__rule" x="490" y="199" width="36" height="3" rx="1.5" />
        </g>

        <path className="auth-illustration__tint" transform="translate(0 7)" d={PAGE} />
        <path className="auth-illustration__paper" transform="translate(0 3)" d={PAGE} />
        <path className="auth-illustration__paper" d={PAGE} />

        <path
          className="auth-illustration__soft"
          d="M350 216C354 216 357 218 360 221C363 218 366 216 370 216V484C366 484 363 486 360 489C357 486 354 484 350 484V216Z"
        />
        <path className="auth-illustration__fine" d="M360 222V488" strokeWidth="1" />

        <rect className="auth-illustration__soft" x="191" y="243" width="30" height="33" rx="8" />
        <path
          className="auth-illustration__accent-outline"
          d="M200 251H212V269L209 266L206 269L203 266L200 269V251ZM204 256H208M204 261H208"
          strokeWidth="1.4"
          {...ROUND}
        />
        <rect className="auth-illustration__ink" x="234" y="251" width="64" height="6" rx="3" />
        <rect className="auth-illustration__rule" x="234" y="266" width="42" height="4" rx="2" />

        <circle className="auth-illustration__soft" cx="204" cy="314" r="12" />
        <path
          className="auth-illustration__accent-outline"
          d="M199 311H208V316C208 320 199 320 199 316V311ZM208 312H210C213 312 213 316 209 316M198 322H210"
          strokeWidth="1.4"
          {...ROUND}
        />
        <rect className="auth-illustration__muted" x="230" y="306" width="49" height="5" rx="2.5" />
        <rect className="auth-illustration__rule" x="230" y="319" width="33" height="4" rx="2" />
        <rect className="auth-illustration__muted" x="305" y="309" width="21" height="5" rx="2.5" />
        <path className="auth-illustration__fine" d="M192 338H326" strokeWidth="1" />

        <circle className="auth-illustration__soft" cx="204" cy="365" r="12" />
        <path className="auth-illustration__accent-outline" d="M198 363H210L208 370H200L198 363ZM200 363L204 359L208 363" strokeWidth="1.4" {...ROUND} />
        <rect className="auth-illustration__muted" x="230" y="357" width="43" height="5" rx="2.5" />
        <rect className="auth-illustration__rule" x="230" y="370" width="29" height="4" rx="2" />
        <rect className="auth-illustration__muted" x="302" y="360" width="24" height="5" rx="2.5" />
        <path className="auth-illustration__fine" d="M192 389H326" strokeWidth="1" />

        <circle className="auth-illustration__soft" cx="204" cy="416" r="12" />
        <path className="auth-illustration__accent-outline" d="M199 420V414L204 410L209 414V420H205V416H203V420H199Z" strokeWidth="1.4" {...ROUND} />
        <rect className="auth-illustration__muted" x="230" y="408" width="55" height="5" rx="2.5" />
        <rect className="auth-illustration__rule" x="230" y="421" width="37" height="4" rx="2" />
        <rect className="auth-illustration__muted" x="307" y="411" width="19" height="5" rx="2.5" />

        <path className="auth-illustration__accent" d="M504 216H526V279L515 271L504 279V216Z" />
        <rect className="auth-illustration__ink" x="391" y="250" width="65" height="6" rx="3" />
        <rect className="auth-illustration__rule" x="391" y="265" width="43" height="4" rx="2" />
        <path className="auth-illustration__soft" d="M391 375L415 354L438 361L462 332L486 342L522 306V391H391V375Z" />
        <path className="auth-illustration__accent-outline" d="M391 375L415 354L438 361L462 332L486 342L522 306" strokeWidth="3" {...ROUND} />
        <path className="auth-illustration__fine" d="M391 391H523" strokeWidth="1" />
        <circle className="auth-illustration__accent" cx="522" cy="306" r="4" />
        <rect className="auth-illustration__rule" x="391" y="419" width="43" height="4" rx="2" />
        <rect className="auth-illustration__accent" x="470" y="415" width="53" height="10" rx="5" />
        <rect className="auth-illustration__rule" x="391" y="443" width="83" height="4" rx="2" />
      </g>
    </g>
  );
}

function SignupScene() {
  return (
    <g className="auth-illustration__scene">
      <rect className="auth-illustration__backdrop" x="84" y="137" width="392" height="491" rx="132" transform="rotate(-6 280 382)" />
      <g className="auth-illustration__shadow" transform="rotate(-4 280 375)">
        <rect className="auth-illustration__tint" x="145" y="161" width="282" height="442" rx="24" />
        <rect className="auth-illustration__paper" x="142" y="155" width="282" height="442" rx="24" />
        <rect className="auth-illustration__paper" x="138" y="148" width="282" height="442" rx="24" />
        <path className="auth-illustration__soft" d="M162 148H177V590H162C148.7 590 138 579.3 138 566V172C138 158.7 148.7 148 162 148Z" />
        <path className="auth-illustration__fine" d="M177 166V572" strokeWidth="1" />
        <path className="auth-illustration__accent" d="M352 148H377V226L364.5 217L352 226V148Z" />

        <g transform="translate(18.5 0)">
          <rect className="auth-illustration__soft" x="238" y="258" width="84" height="92" rx="23" />
          <path
            className="auth-illustration__accent-outline"
            d="M264 280H296V322L290 317L283 322L277 317L270 322L264 317V280ZM272 292H288M272 301H285M272 310H281"
            strokeWidth="2"
            {...ROUND}
          />
          <rect className="auth-illustration__ink" x="222" y="378" width="116" height="8" rx="4" />
          <rect className="auth-illustration__rule" x="245" y="400" width="70" height="5" rx="2.5" />
          <path className="auth-illustration__fine" d="M247 519H313" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

export function AuthIllustration({ variant }: { variant: "login" | "signup" }) {
  return (
    <div className={`auth-illustration auth-illustration--${variant}`} aria-hidden="true">
      <svg
        className="auth-illustration__art"
        viewBox={variant === "signup" ? "0 0 560 760" : "0 0 720 720"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        {variant === "signup" ? <SignupScene /> : <LoginScene />}
      </svg>
    </div>
  );
}
