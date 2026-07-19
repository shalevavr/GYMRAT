const CACHE_NAME = 'gymrat-offline-v20260718-i18n-v163';
const APP_SHELL = [
    './',
    './AccountSelect.html',
    './Abs.html',
    './AbsE.html',
    './Anatomy.html',
    './AnatomyAbs.html',
    './AnatomyBack.html',
    './AnatomyBiceps.html',
    './AnatomyCalves.html',
    './AnatomyChest.html',
    './AnatomyForearms.html',
    './AnatomyGlutes.html',
    './AnatomyHamstrings.html',
    './AnatomyQuadriceps.html',
    './AnatomyShoulders.html',
    './AnatomyTriceps.html',
    './anatomy-detail.js',
    './Pictures/Logos/apple-touch-icon.png',
    './auth.js',
    './i18n.js',
    './Back.html',
    './BackE.html',
    './Biceps.html',
    './BicepsE.html',
    './Calves.html',
    './CalvesE.html',
    './Chest.html',
    './ChestE.html',
    './Css.css',
    './Diet.html',
    './Diet.js',
    './vendor/zxing-browser.min.js',
    './DietSetup.html',
    './DietSetup.js',
    './AI Diet Instruction.txt',
    './ExercisesGuide.html',
    './Favorites.html',
    './Forearms.html',
    './ForearmsE.html',
    './Glutes.html',
    './GlutesE.html',
    './GymWorkoutPlanner.html',
    './Hamstrings.html',
    './HamstringsE.html',
    './index.html',
    './Js.js',
    './SiteNav.js',
    './manifest.json',
    './MainPage.html',
    './MyPlans.html',
    './Pictures/Exercises/45_Degree_calf_raises.webp',
    './Pictures/Exercises/Ab_rollers.webp',
    './Pictures/Animations/Animation_abs.webp',
    './Pictures/Muscles/Abs.webp',
    './Pictures/Muscles/Abs2.webp',
    './Pictures/Animations/Animation_back.webp',
    './Pictures/Animations/Animation_biceps.webp',
    './Pictures/Animations/Animation_calves.webp',
    './Pictures/Animations/Animation_chest.webp',
    './Pictures/Animations/Animation_forearms.webp',
    './Pictures/Muscles/Forearms.webp',
    './Pictures/Muscles/Forearms2.webp',
    './Pictures/Muscles/Forearms3.webp',
    './Pictures/Muscles/Forearms4.webp',
    './Pictures/Muscles/Forearms5.webp',
    './Pictures/Animations/Animation_full_body.webp',
    './Pictures/Animations/BodyFatPrecentMen.webp',
    './Pictures/Animations/BodyFatPrecentWomen.webp',
    './Pictures/Animations/Animation_glutes.webp',
    './Pictures/Muscles/Glutes.webp',
    './Pictures/Muscles/Glutes2.webp',
    './Pictures/Animations/Animation_hamstrings.webp',
    './Pictures/Muscles/Hamstrings.webp',
    './Pictures/Muscles/Hamstrings2.webp',
    './Pictures/Animations/Animation_quadriceps.webp',
    './Pictures/Muscles/Quads.webp',
    './Pictures/Muscles/Quads2.webp',
    './Pictures/Animations/Animation_shoulders.webp',
    './Pictures/Muscles/Shoulders.webp',
    './Pictures/Animations/Animation_triceps.webp',
    './Pictures/Exercises/Archer_pulls.webp',
    './Pictures/Exercises/Archer_push_ups.webp',
    './Pictures/Exercises/Barbell_front_squats.webp',
    './Pictures/Exercises/Barbell_squats.webp',
    './Pictures/Exercises/Barbell_wrist_extensions.webp',
    './Pictures/Muscles/Back2.webp',
    './Pictures/Muscles/Back3.webp',
    './Pictures/Muscles/Calves1.webp',
    './Pictures/Muscles/Calves2.webp',
    './Pictures/Muscles/Back.webp',
    './Pictures/Exercises/Bayesian_curls.webp',
    './Pictures/Exercises/Behind_the_back_wrist_curls.webp',
    './Pictures/Exercises/Belt_squats.webp',
    './Pictures/Exercises/Bent_over_rows.webp',
    './Pictures/Muscles/Biceps.webp',
    './Pictures/Logos/Bookmark.webp',
    './Pictures/Exercises/Bosso_sit_ups.webp',
    './Pictures/Exercises/Bulgarian_split_squats.webp',
    './Pictures/Exercises/Cable_crunches.webp',
    './Pictures/Exercises/Cable_curls.webp',
    './Pictures/Exercises/Cable_front_raises.webp',
    './Pictures/Exercises/Cable_lat_pull_overs.webp',
    './Pictures/Exercises/Cable_rows.webp',
    './Pictures/Exercises/Cable_rows_wide_grip.webp',
    './Pictures/Exercises/Cable_woodchoppers.webp',
    './Pictures/Muscles/Chest.webp',
    './Pictures/Exercises/Chest_supported_rows.webp',
    './Pictures/Exercises/Chin_ups.webp',
    './Pictures/Exercises/Close_grip_bench_presses.webp',
    './Pictures/Exercises/Cross_body_hammer_curls.webp',
    './Pictures/Exercises/Cross_body_lat_pull_arounds.webp',
    './Pictures/Exercises/Crossing_legs_cable_hip_abductions.webp',
    './Pictures/Exercises/Dead_hangs.webp',
    './Pictures/Exercises/Decline_sit_ups.webp',
    './Pictures/Exercises/Deficit_push_ups.webp',
    './Pictures/Exercises/Diamond_push_ups.webp',
    './Pictures/Exercises/Dips.webp',
    './Pictures/Exercises/Donkey_calf_raises.webp',
    './Pictures/Exercises/Dragon_flags.webp',
    './Pictures/Exercises/Dumbbell_flys.webp',
    './Pictures/Exercises/Dumbbell_lateral_raises.webp',
    './Pictures/Exercises/Dumbbell_wrist_curls.webp',
    './Pictures/Exercises/Dumbbell_wrist_extensions.webp',
    './Pictures/Exercises/EZ_bar_curls.webp',
    './Pictures/Exercises/Glute_bridges.webp',
    './Pictures/Exercises/Glute_bridges_with_elevated_foot.webp',
    './Pictures/Exercises/Goblet_squats.webp',
    './Pictures/Exercises/Hack_squats.webp',
    './Pictures/Exercises/Hammer_curls.webp',
    './Pictures/Exercises/Hand_grippers.webp',
    './Pictures/Exercises/Hanging_leg_raises.webp',
    './Pictures/Exercises/Hip_abductions.webp',
    './Pictures/Exercises/Hip_thrusts.webp',
    './Pictures/Logos/Icon.webp',
    './Pictures/Logos/Img_no_star.webp',
    './Pictures/Logos/pwa-icon-192.png',
    './Pictures/Logos/pwa-icon-512.png',
    './Pictures/Logos/pwa-icon-1024.png',
    './Pictures/Logos/pwa-launch-192.png',
    './Pictures/Logos/pwa-launch-512.png',
    './Pictures/Logos/pwa-launch-maskable-512.png',
    './Pictures/Logos/pwa-launch-1024.png',
    './Pictures/Exercises/Incline_bench_presses.webp',
    './Pictures/Exercises/Incline_curls.webp',
    './Pictures/Exercises/Incline_dumbbell_bench_presses.webp',
    './Pictures/Exercises/Lat_pulldowns.webp',
    './Pictures/Exercises/Lateral_raises_machine.webp',
    './Pictures/Exercises/Leaning_cable_lateral_raises.webp',
    './Pictures/Exercises/Leaning_dumbbell_lateral_raises.webp',
    './Pictures/Exercises/Leg_extensions.webp',
    './Pictures/Exercises/Leg_presses.webp',
    './Pictures/Exercises/Leg_raises.webp',
    './Pictures/Exercises/Lying_leg_curls.webp',
    './Pictures/Exercises/Machine_chest_presses.webp',
    './Pictures/Exercises/Machine_dips.webp',
    './Pictures/Exercises/Machine_shoulder_presses.webp',
    './Pictures/Exercises/Neutral_grip_pull_ups.webp',
    './Pictures/Exercises/Nordics.webp',
    './Pictures/Exercises/One_arm_dumbbell_rows.webp',
    './Pictures/Exercises/One_arm_seated_lever_reverse_flys.webp',
    './Pictures/Exercises/Overhead_cable_triceps_extensions.webp',
    './Pictures/Exercises/Pec_deck_flys.webp',
    './Pictures/Exercises/Pendulum_squats.webp',
    './Pictures/Exercises/Plate_pinches.webp',
    './Pictures/Exercises/Preacher_curls.webp',
    './Pictures/Exercises/Reverse_cable_crossovers.webp',
    './Pictures/Exercises/Reverse_grip_curls.webp',
    './Pictures/Exercises/Reverse_lunges.webp',
    './Pictures/Exercises/Reverse_nordics.webp',
    './Pictures/Exercises/Romanian_deadlifts.webp',
    './Pictures/Exercises/Seated_cable_flys.webp',
    './Pictures/Exercises/Seated_calf_raises.webp',
    './Pictures/Exercises/Seated_hamstrings_curls.webp',
    './Pictures/Exercises/Seated_overhead_triceps_extensions.webp',
    './Pictures/Exercises/Single_leg_calf_raises.webp',
    './Pictures/Exercises/Single_leg_hip_thrusts.webp',
    './Pictures/Exercises/Sit_ups.webp',
    './Pictures/Exercises/Skullcrushers.webp',
    './Pictures/Exercises/Smith_machine_calf_raises.webp',
    './Pictures/Exercises/Smith_machine_curtsy_lunges.webp',
    './Pictures/Exercises/Smith_machine_incline_bench_presses.webp',
    './Pictures/Exercises/Spider_curls.webp',
    './Pictures/Exercises/Standing_calf_raises.webp',
    './Pictures/Exercises/Standing_dumbbell_curls.webp',
    './Pictures/Exercises/Standing_hammer_curls.webp',
    './Pictures/Exercises/Stiff_legs_romanian_deadlifts.webp',
    './Pictures/Exercises/Triceps_cable_kickbacks.webp',
    './Pictures/Muscles/Triceps.webp',
    './Pictures/Exercises/Triceps_dumbbell_kickbacks.webp',
    './Pictures/Exercises/Triceps_pressdowns.webp',
    './Pictures/Exercises/Upright_rows.webp',
    './Pictures/Exercises/V_ups.webp',
    './Pictures/Exercises/Walking_lunges.webp',
    './Pictures/Exercises/Wide_grip_pull_ups.webp',
    './Pictures/Exercises/Wrist_rollers.webp',
    './Quadriceps.html',
    './QuadricepsE.html',
    './Shoulders.html',
    './ShouldersE.html',
    './Table.js',
    './TermsOfUse.html',
    './Triceps.html',
    './TricepsE.html',
    './WeightsTrackingMenu.html',
    './WorkoutPlanMainPage.html'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(APP_SHELL.map(async url => {
            try {
                await cache.add(url);
            } catch (error) {
                console.warn('Skipping offline cache item:', url, error);
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

function getCacheKey(request) {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return null;
    if (url.pathname === '/' || url.pathname === '') return './index.html';
    return `./${url.pathname.replace(/^\//, '')}`;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = getCacheKey(request);
        const cached = cacheKey ? await cache.match(cacheKey) : null;
        const extension = url.pathname.split('.').pop().toLowerCase();
        const shouldRefreshFirst = request.mode === 'navigate' || ['html', 'js', 'css', 'json'].includes(extension) || url.pathname.endsWith('/Pictures/Logos/apple-touch-icon.png') || url.pathname.endsWith('/Pictures/Logos/Img_no_star.webp') || url.pathname.endsWith('/Pictures/Logos/pwa-icon-192.png') || url.pathname.endsWith('/Pictures/Logos/pwa-icon-512.png') || url.pathname.endsWith('/Pictures/Logos/pwa-icon-1024.png') || url.pathname.endsWith('/Pictures/Logos/pwa-launch-192.png') || url.pathname.endsWith('/Pictures/Logos/pwa-launch-512.png') || url.pathname.endsWith('/Pictures/Logos/pwa-launch-maskable-512.png') || url.pathname.endsWith('/Pictures/Logos/pwa-launch-1024.png') || url.pathname.endsWith('/Pictures/Muscles/Forearms4.webp') || url.pathname.endsWith('/Pictures/Muscles/Hamstrings2.webp') || url.pathname.endsWith('/Pictures/Muscles/Calves1.webp') || url.pathname.endsWith('/Pictures/Muscles/Calves2.webp');

        if (shouldRefreshFirst) {
            try {
                const response = await fetch(request);
                if (response && response.ok && cacheKey) {
                    cache.put(cacheKey, response.clone());
                }
                return response;
            } catch (error) {
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    return (await cache.match('./index.html')) || Response.error();
                }
                return Response.error();
            }
        }

        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(request);
            if (response && response.ok && cacheKey) {
                cache.put(cacheKey, response.clone());
            }
            return response;
        } catch (error) {
            return cached || Response.error();
        }
    })());
});







































