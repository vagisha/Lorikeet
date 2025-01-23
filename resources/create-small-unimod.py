import xml.etree.ElementTree as ET

def filter_umod_elements(input_file, output_file, record_id_list):
    """
    Filters <umod:mod> elements based on the record_id attribute.
    """
    # Define namespace
    namespace = 'http://www.unimod.org/xmlns/schema/unimod_2'
    ET.register_namespace('umod', namespace)
    
    # Parse the entire XML tree
    tree = ET.parse(input_file)
    root = tree.getroot()
    
    # Create a new root element with the same namespace
    new_root = ET.Element(root.tag, root.attrib)
    
    # Iterate through all child elements
    for elem in root:
        if elem.tag == f'{{{namespace}}}modifications':
            # Create modifications element
            new_modifications = ET.SubElement(new_root, elem.tag)
            
            # Filter mod elements
            for mod in elem.findall(f'{{{namespace}}}mod'):
                record_id = mod.get('record_id')
                if record_id in record_id_list:
                    new_modifications.append(mod)
        else:
            # Add all other elements as-is
            new_root.append(elem)
    
    # Define a function to add indentation
    def indent_tree(elem, level=0):
        i = "\n" + "  " * level
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = i + "  "
            for child in elem:
                indent_tree(child, level + 1)
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
        else:
            if not elem.tail or not elem.tail.strip():
                elem.tail = i
    
    # Apply indentation to the new tree
    indent_tree(new_root)
    
    # Write the formatted XML to the output file
    tree = ET.ElementTree(new_root)
    with open(output_file, 'wb') as f:
        tree.write(f, encoding='utf-8', xml_declaration=True)

# Example usage
input_file = 'unimod.xml'
output_file = 'unimod-small.xml'
record_id_list = ['1', '4', '7', '21', '27', '28', '34', '35', '36']
filter_umod_elements(input_file, output_file, record_id_list)
