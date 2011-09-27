var root = {
	canonical: "Ala",
	left: {
		canonical: "ma"
	},
	right: {
		canonical: "kota",
		left: {
			canonical: "or",
			left: {
				canonical: "it does"
			},
			right: {
				canonical: "not"
			}
		}
	}
};

var reformatTree = function(node) {
	if (node.hasOwnProperty('canonical')) {
		node['name'] = node['canonical'];
		delete node['canonical'];
	}
	
	if (node.hasOwnProperty('left')) {
		node['children'] = node['children'] || []; 
		node['children'].push( node['left']);
		delete node['left'];
	}
	
	if (node.hasOwnProperty('right')) {
		node['children'] = node['children'] || []; 
		node['children'].push( node['right']);
		delete node['right'];
	}
	
	if (node.hasOwnProperty('children')) {
		var nChildren = node
		node['children'].forEach(reformaTree(child));
	}
};

console.log(root);
reformatTree(root);
console.log(root);