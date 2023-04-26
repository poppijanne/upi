/* global app:true, Vue, VueRouter, moment, userStore, organizationsDashboard, organizationDashboard, leagueDashboard, leagueEditor, seasonDashboard, editSeason, editDivision, editRound, playerDashboard, editPlayer, gameDashboard, editTrophy */

// VUE stuff:

// Understanding Vue.js Lifecycle Hooks
// https://alligator.io/vuejs/component-lifecycle/

// Router
// https://router.vuejs.org/guide/#javascript

// Bootstrap components
// https://v4-alpha.getbootstrap.com/components

// Sanastoa
// league = liiga
// division = sarjataso / lohko
// season = kausi

/*
TODO:
throphy dashboard
*/

initVue();

function initVue() {

    Vue.filter('formatDate', function (value) {
        if (value !== undefined) {
            if (typeof value === 'string') {
                if (value.indexOf('T') !== -1) {
                    value = value.split('T')[0];
                }
            }
            //if (value.indexOf('T') !== -1) {
            //    value = value.split('T')[0];
            //}
            return moment(String(value)).format('DD.MM.YYYY')
        }
    });

    const routes = [
        { path: '/', name: 'organizations', component: organizationsDashboard },
        { path: '/organization/:organizationId', name: 'organization', component: organizationDashboard },
        { path: '/organization/:organizationId/league-dashboard/:leagueId', name: 'view-league', component: leagueDashboard },
        { path: '/organization/:organizationId/league', name: 'new-league', component: leagueEditor },
        { path: '/organization/:organizationId/league/:leagueId', name: 'edit-league', component: leagueEditor },
        { path: '/organization/:organizationId/league/:leagueId/season-dashboard/:seasonId', name: 'view-season', component: seasonDashboard },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId', name: 'edit-season', component: editSeason },
        { path: '/organization/:organizationId/league/:leagueId/season', name: 'new-season', component: editSeason },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/division/:divisionId', name: 'edit-division', component: editDivision },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/division', name: 'new-division', component: editDivision },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/round/:roundId', name: 'edit-round', component: editRound },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/round', name: 'new-round', component: editRound },
        { path: '/organization/:organizationId/player-dashboard/:playerId', name: 'view-player', component: playerDashboard },
        { path: '/organization/:organizationId/other-player-dashboard/:playerId', name: 'view-other-player', component: playerDashboard },
        { path: '/organization/:organizationId/player/:playerId', name: 'edit-player', component: editPlayer },
        { path: '/organization/:organizationId/player', name: 'new-player', component: editPlayer },
        { path: '/organization/:organizationId/game/:gameId', name: 'game', component: gameDashboard },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/trophy', name: 'new-trophy', component: editTrophy },
        { path: '/organization/:organizationId/league/:leagueId/season/:seasonId/trophy/:trophyId', name: 'edit-trophy', component: editTrophy }
    ];

    let router = new VueRouter({
        routes,
        scrollBehavior(to, from, savedPosition) {
            console.log(to.name);
            if (to.name === "view-season" || from.name === "game") {
                return savedPosition;
            }
            return { x: 0, y: 0 };
        }
    });

    app = new Vue({
        router,
        data: {
            loaders: 0,
            breadcrumbs: [],
            userStore: userStore
        },
        computed: {
            loading() {
                return this.loaders > 0;
            }
        },
        methods: {
            navigate: function (steps) {
                this.$router.go(steps);
            },
            goBack() {
                this.$router.back();
            },
            goHome() {
                // FIXME
                this.$router.push({
                    name: "organization",
                    params: {
                        organizationId: "608e2b1ba76ae6e9fd6480658df237c0"
                    }
                });
            }
        }
    }).$mount('#app');
}

window.addEventListener('popstate', () => {
    app.currentRoute = window.location.pathname;
})