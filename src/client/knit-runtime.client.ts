import { KnitClient as Knit } from '@rbxts/knit';

let modules: Instance[] = (script.Parent!.FindFirstChild('controllers') as Folder).GetDescendants();
for (let module of modules) {
    if (module.IsA('ModuleScript')) {
        require(module);
    }
}

Knit.Start().catch(warn);