// Get list
let target = self.runtime.getTargetById(list.target);
let tmp = target.lookupVariableByNameAndType(list.id, "list");

// Update value
tmp.value = message.payload.value;
tmp._monitorUpToDate = false;

// Store the message
lists = self.getChannelState(chan.label, peerID).lists;
variables = self.getChannelState(chan.label, peerID).vars;

// Update lists
for (const key in lists) {
    let list = lists[key];
    let target = self.runtime.getTargetById((list.target));
    if (!target) continue;
    let tmp = target.lookupVariableByNameAndType(list.id, "list")
    if (!tmp) continue;
    tmp.value.push(self.makeValueScratchSafe(message.payload));
    tmp._monitorUpToDate = false;
}

// Update variables
for (const key in variables) {
    let variable = variables[key];
    let target = self.runtime.getTargetById((variable.target));
    if (!target) continue;
    let tmp = target.lookupVariableByNameAndType(variable.id, "")
    if (!tmp) continue;
    tmp.value = self.makeValueScratchSafe(message.payload);
}

// Get variable
let variable = util.target.lookupVariableByNameAndType(args.VAR, "");
if (variable) {
    // ...
}