function runTestSuites(suites) {
    suites.forEach(suite => {
        runTestSuite(suite);
    })
}

function runTestSuite(suite) {
    for (let i in suite) {
        try {
            suite[i]();
        }
        catch (e) {
            console.error(e);
        }
    }
}

// and yet another mandatory update to keep app running
runTestSuites([
    require("./test-game")
])