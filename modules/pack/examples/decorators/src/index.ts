@log
class Dog {
	bark() {
		console.log("Au!");
	}

	constructor(public name: string) {}
}

const Willian = new Dog("Willian");
const Puppy = new Dog("Puppy");

Willian.bark();
Puppy.bark();