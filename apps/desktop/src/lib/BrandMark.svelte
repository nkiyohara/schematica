<script lang="ts">
  const markId = `brand-${Math.random().toString(36).slice(2)}`;
</script>

<svg class="brand-mark" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id={`${markId}-tile`} x1="144" x2="874" y1="108" y2="928" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#252b34" />
      <stop offset="0.52" stop-color="#111820" />
      <stop offset="1" stop-color="#07090d" />
    </linearGradient>
    <linearGradient id={`${markId}-north`} x1="112" x2="864" y1="96" y2="440" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.2" />
      <stop offset="0.42" stop-color="#b9f2ea" stop-opacity="0.1" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id={`${markId}-south`} x1="84" x2="936" y1="710" y2="954" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f7bd65" stop-opacity="0.15" />
      <stop offset="0.56" stop-color="#34d6bd" stop-opacity="0.13" />
      <stop offset="1" stop-color="#b7a7ff" stop-opacity="0.15" />
    </linearGradient>
    <linearGradient id={`${markId}-ribbon`} x1="244" x2="786" y1="276" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6e8" />
      <stop offset="0.28" stop-color="#d7f7f0" />
      <stop offset="0.56" stop-color="#3bd6c4" />
      <stop offset="0.78" stop-color="#56b8f4" />
      <stop offset="1" stop-color="#f08aa5" />
    </linearGradient>
    <linearGradient id={`${markId}-edge`} x1="274" x2="760" y1="250" y2="806" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.84" />
      <stop offset="0.48" stop-color="#ffffff" stop-opacity="0.34" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.18" />
    </linearGradient>
    <linearGradient id={`${markId}-frame`} x1="120" x2="904" y1="114" y2="902" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22" />
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.14" />
    </linearGradient>
    <clipPath id={`${markId}-mask`}>
      <rect x="72" y="72" width="880" height="880" rx="226" />
    </clipPath>
  </defs>

  <g clip-path={`url(#${markId}-mask)`}>
    <rect x="72" y="72" width="880" height="880" rx="226" fill={`url(#${markId}-tile)`} />
    <path
      d="M72 72h880v306c-132 58-280 88-444 88-184 0-330 42-436 126V72Z"
      fill={`url(#${markId}-north)`}
    />
    <path
      d="M72 738c106-58 244-88 414-88 214 0 370-40 466-118v420H72V738Z"
      fill={`url(#${markId}-south)`}
    />

    <g opacity="0.28">
      <path d="M258 340h508" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-opacity="0.14" stroke-width="14" />
      <path d="M258 512h508" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-opacity="0.1" stroke-width="14" />
      <path d="M258 684h508" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-opacity="0.12" stroke-width="14" />
    </g>

    <g transform="rotate(-4 512 512)">
      <path
        d="M682 276H374c-78 0-128 46-128 112s50 112 128 112h276c78 0 128 46 128 112s-50 112-128 112H342"
        fill="none"
        stroke="#020407"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.34"
        stroke-width="132"
        transform="translate(0 26)"
      />
      <path
        d="M682 276H374c-78 0-128 46-128 112s50 112 128 112h276c78 0 128 46 128 112s-50 112-128 112H342"
        fill="none"
        stroke="#091018"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.5"
        stroke-width="118"
      />
      <path
        d="M682 276H374c-78 0-128 46-128 112s50 112 128 112h276c78 0 128 46 128 112s-50 112-128 112H342"
        fill="none"
        stroke={`url(#${markId}-ribbon)`}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="92"
      />
      <path
        d="M682 276H374c-78 0-128 46-128 112s50 112 128 112h276c78 0 128 46 128 112s-50 112-128 112H342"
        fill="none"
        stroke={`url(#${markId}-edge)`}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="20"
      />
      <path
        d="M368 500h286"
        fill="none"
        stroke="#ffffff"
        stroke-linecap="round"
        stroke-opacity="0.22"
        stroke-width="12"
      />
    </g>

    <rect
      x="112"
      y="112"
      width="800"
      height="800"
      rx="188"
      fill="none"
      stroke={`url(#${markId}-frame)`}
      stroke-width="3"
    />
  </g>
</svg>

<style>
  .brand-mark {
    display: block;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    filter: drop-shadow(0 12px 20px rgb(15 23 42 / 0.18));
  }
</style>
