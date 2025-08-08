class Graph {
    injectables = new Set<Injectable>;
    managers = new Set<Manager>;
    commands = new Set<unknown>;
    routes = new Set<Route>;
    events = new Set<Event>;
}

export default Graph;

interface Event {}

interface Route {}

interface Manager {}

interface Injectable {}
