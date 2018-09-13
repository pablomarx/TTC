//
//  Program.js
//  TinyAsm 
//
//  Created by Steve White on 7/17/18.
//  Copyright (c) 2018 Steve White. All rights reserved.
//
var char = {
	IsWhiteSpace: function(line, pos) {
		return (line[pos].match(/\s/) != null);
	},
	IsDigit: function(line, pos) {
		return (line[pos].match(/\d/) != null);
	},
	IsLetterOrDigit: function(line, pos) {
		return (line[pos].match(/\w/) != null);
	},
	IsLetter: function(line, pos) {
		return (line[pos].match(/[a-z]/i) != null);
	},
};

class StreamWriter {
	constructor(filename) {
		this.filename = filename;
		this.element = document.getElementById(filename);
		this.lines = [];
	}
	WriteLine(line) {
		this.lines.push(line);
	}
	Close() {
		this.element.value = this.lines.join("\n");
		this.lines = [];
	}
}

var Console = null;

function toHex(value) {
	var result = "";
	for (var i=0; i<8; i++) {
		var nibble = (value >> 28) & 0xf;
		if (nibble < 10) {
			result += String.fromCharCode(0x30 + nibble);
		} 
		else {
			result += String.fromCharCode(0x41 + (nibble - 10));
		}
		value = value << 4;
	}
	return result;
}

//tokens gathered in line processing
class Token  
{
    constructor(type, value, str) {
        this.type = type;
        this.value = value;
        this.str = str;
    }
}

//entries in the symbol table.  a field of two ints.
class Symbol  
{
    constructor(value, offset) {
        this.value = value;
        this.offset = offset;
    }
}

class Assembler
{
    Assemble(source, outName) {
        Console = new StreamWriter("console");
		
        this.errorCnt = 0;
        this.lst = new StreamWriter("listing.txt");
        this.currentLocations = new Array(0, 0, 0);
        this.locsUsed = new Array(0, 0, 0);
        this.Symbols = {};
        this.currentMemory = 0;
        this.Memories = new Array(3);
        for (var i=0; i<this.Memories.length; i++) {
            this.Memories[i] = new Array(1024);
            for (var j=0; j<this.Memories[i].length; j++) {
                this.Memories[i][j] = 0;
            }
        }
		
        var lineNumber;
        var pc = 0;
        var line;
        for (var pass = 1; pass < 3; pass++)  //do pass 1, pass 2
        {
            lineNumber = 0;
            for (var j = 0; j < 3; j++)
            { //clear all location counters
                this.currentLocations[j] = 0;
                this.locsUsed[j] = 0;
            }
            this.currentMemory = 0; //IM is the target memory.

            var lines = source.split("\n");
            for (var lineNumber = 0; lineNumber<lines.length; lineNumber++) {
                line = lines[lineNumber];
                pc = this.ProcessLine(line, lineNumber, pass);
                if (pass == 2)
                {
                    if (pc > 0) this.lst.WriteLine(pc+":\t"+line);
                    else this.lst.WriteLine("     \t"+ line);
                }
            }
        }

        for (var mx = 0; mx < 3; mx++) this.lst.WriteLine("Memory "+mx+": "+this.locsUsed[mx]+" location(s) initialized");
        this.lst.WriteLine(this.errorCnt+" Errors.");
        this.lst.Close();
        for (var mx = 0; mx < 3; mx++)
        {
            Console.WriteLine("Memory "+mx+": "+this.locsUsed[mx]+" location(s) initialized");
            if (this.locsUsed[mx] != 0)
            {
                for (var i = 0; i < 1024; i++)
                {
                    var x = this.Memories[mx][i];
                    if (x != 0) //only print nonzero locations
                    {
                        x = x;
/*                            if (mx == 0) //format printing of IM
                        {
                        */
                        Console.WriteLine(" "+(i)+": "+toHex(x)+" Rw = "+((x >> 25) & 0x7f)+", Ra = "+(x >> 17 & 0x7f)+", Rb = "+(x >> 10 & 0x7f)+", F = "+(x >> 7 & 7)+", Sh = "+(x >> 5 & 3)+", Sk = "+(x >> 3 & 3)+", Op = "+(x & 7));
                                    /*
                        }
*/                            /*else */ //Console.WriteLine(" "+i+": "+toHex(x));
                    }
                }
            }
        }
        //Write the .mem files
        for (var mem = 0; mem < 3; mem++)
        {
            var fname = outName + mem + ".mem";
            var contents; //contents of location mem;
            var sw = new StreamWriter(fname);
            sw.WriteLine("// mem file for memory "+ mem);
//                sw.WriteLine("memory_initialization_radix=16;");
//                sw.WriteLine("memory_initialization_vector=");
            sw.WriteLine("@0000");
            for (var m = 0; m < 910; m++)
            {
                contents = this.Memories[mem][m];
                sw.WriteLine(toHex(contents));
//                    if (m < 1023) sw.WriteLine(",");
//                    else sw.WriteLine(";");
            }
            sw.Close();

        }
        Console.Close();
    }

    ProcessLine(line, lineNumber, pass) {
        var pc = 0;
        const tokmax = 64;
        var tokens = new Array(tokmax);
        for (var i = 0; i < tokens.length; i++) tokens[i] = new Token(0, 0, "");  //we will reuse these
        var currentValue;
        var hasCurrentValue;

        if (line.length <= 0)
        {
            return pc;
        }
		
        var pos = 0; var start = 0; var ntokens = 0; currentValue = 0; hasCurrentValue = false;
        while (pos < line.length && ntokens < tokmax) //scan the line for Tokens
        {
            if (char.IsWhiteSpace(line, pos)) pos++; //skip white space
            else if (line[pos] == ';') pos = line.length; //skip the rest of the line
            else if (char.IsDigit(line, pos)) //get a number
            {
                start = pos;
                while (pos < line.length && char.IsLetterOrDigit(line, pos))
                    pos++;  //non-digit or end of line
                var q = line.substr(start, pos - start);
                tokens[ntokens].value = this.StringValue(q); // long.Parse(q);
                tokens[ntokens++].type = 0; //a number
            }
            else if (char.IsLetter(line, pos))//get a string
            {
                start = pos;
                while (pos < line.length && char.IsLetterOrDigit(line, pos)) pos++;
                tokens[ntokens].str = line.substr(start, pos - start);
                tokens[ntokens++].type = 1;  //string
            }
            else
            { //non-letter, non-digit, non-white space.  But stop on ';'.  
                start = pos;
                while (pos < line.length && !char.IsWhiteSpace(line, pos) &&
                    !char.IsLetter(line, pos) && (line[pos] != ';')) pos++;
                tokens[ntokens].str = line.substr(start, pos - start);
                tokens[ntokens++].type = 1; //a string
            }
        }

        //now process each token in a line in turn
        //during pass 1, we define fields, during pass 2, we emit code
        //(any undefined symbols are errors)
        var i = 0;
        while (i < ntokens)
        {
            var currentToken = tokens[i];
            //Check for reserved words
            if (currentToken.type == 1) // string
            {
                if (currentToken.str == ":")
                { //make a label (pass 1 only)
                    if (pass == 1)
                    {
                        var cloc = this.currentLocations[this.currentMemory];
                        if (i == 1)  //may appear only as the second token on a line
                        {
                            if (tokens[i - 1].type == 1) //must be a string  //this is the key for the Symbol
                            {
                                //the value is the current location in the current memory, the offset is 0.
                                var s = new Symbol(cloc, 0);
                                this.Symbols[tokens[i - 1].str] = s;
                                hasCurrentValue = true;
                                if (this.currentMemory == 1) //if we're assembling for RF, we can build the rfrefs automatically
                                {
                                    var s1 = this.Symbols["aoff"]; //if null, an exception will be raised shortly
                                    var s2 = this.Symbols["boff"];
                                    var s3 = this.Symbols["woff"];
                                    var s1a = new Symbol(cloc, s1.value);
                                    var s2a = new Symbol(cloc, s2.value);
                                    var s3a = new Symbol(cloc, s3.value);
                                    this.Symbols["a" + (tokens[i - 1].str)] = s1a;
                                    this.Symbols["b" + (tokens[i - 1].str)] = s2a;
                                    this.Symbols["w" + (tokens[i - 1].str)] = s3a;
                                }
                            }
                            else
                            {
                                this.lst.WriteLine
                              ("***Error: Colon may only appear as the second thing on a line. Line "+lineNumber); this.errorCnt++;
                            }
                        }
                        else
                        {
                            this.lst.WriteLine
                          ("***Error: operand of : is not a string. Line "+lineNumber); this.errorCnt++;
                        }
                    }
                    //during pass 2, the symbol will have been
                    //looked up and put into currentValue (incorrectly).  Clear it.
                    hasCurrentValue = true;
                    currentValue = 0;
                    i++;
                }
                else if (currentToken.str == "field")
                { //define a field (pass 1 only)
                    if (pass == 1)
                    {
                        if ((i + 3) < ntokens) //must have enough operands
                        {
                            if (tokens[i + 1].type == 1 && tokens[i + 2].type == 0
                                && tokens[i + 3].type == 0)
                            {
                                var s = new Symbol(tokens[i + 2].value, tokens[i + 3].value);
                                this.Symbols[tokens[i + 1].str] = s;
                            }
                            else
                            {
                                this.lst.WriteLine
                              ("***Error: Arguments for field are of incorrect type. Line "+lineNumber); this.errorCnt++;
                            }
                        }
                        else
                        {
                            this.lst.WriteLine
                          ("***Error: Too few arguments for field. Line "+lineNumber); this.errorCnt++;
                        }
                    }
                    i = i + 4;
                }
                else if (currentToken.str == "rfref")
                {
                    if (pass == 1) //define three fields (pass 1 only)
                    {
                        if ((i + 2) < ntokens) //must have enough operands
                        {
                            if (tokens[i + 1].type == 1) //pre-modified register name and the register number.
                            {
                                var rval = 0;
                                if (tokens[i + 2].type == 1) //if it's a string, it must resolve to a number
                                {
                                    var s0 = this.Symbols[tokens[i + 2].str];
                                    if (s0 != null) rval = s0.value;
                                    else
                                    {
                                        lst.WriteLine("***Error: Undefined sumbol in rfref. Line "+ lineNumber);
                                        this.errorCnt++;
                                    }
                                }

                                else rval = tokens[i + 2].value;
                                var s1 = this.Symbols["aoff"]; //if null, an exception will be raised shortly
                                var s2 = this.Symbols["boff"];
                                var s3 = this.Symbols["woff"];
                                var s1a = new Symbol(rval, s1.value);
                                var s2a = new Symbol(rval, s2.value);
                                var s3a = new Symbol(rval, s3.value);
                                this.Symbols["a" + tokens[i + 1].str] = s1a;
                                this.Symbols["b" + tokens[i + 1].str] = s2a;
                                this.Symbols["w" + tokens[i + 1].str] = s3a;
                            }
                            else
                            {
                                this.lst.WriteLine
                              ("***Error: Arguments for rfref are of incorrect type. Line "+lineNumber); this.errorCnt++;
                            }

                        }
                        else
                        {
                            this.lst.WriteLine(
                          "***Error: Too few arguments for rfref. Line "+lineNumber); this.errorCnt++;
                        }
                    }
                    i = i + 3; //skip over arguments
                }
                else if (currentToken.str == "mem") //both pass 1 and pass 2
                {//set the current memory
                    if ((i + 1) < ntokens)
                    {
                        if (tokens[i + 1].type == 0) this.currentMemory = tokens[i + 1].value; //argument is a number
                        else
                        {
                            var s = this.Symbols[tokens[i + 1].str]; //if it's a string, it must resolve to a number.
                            if (s != null)
                                this.currentMemory = s.value;
                            else
                            {
                                this.lst.WriteLine(
                              "***Error: Undefined symbol "+tokens[i].str+". Line "+lineNumber); this.errorCnt++;
                            }
                        }
                    }
                    else
                    {
                        this.lst.WriteLine(
                      "***Error: too few arguments. Line"+lineNumber); this.errorCnt++;
                    }
                    i = i + 2; //skip over arguments
                }
                else if (currentToken.str == "end") return(pc);
                else if (currentToken.str == "loc")
                {//set the current location in the currentMemory
                    if ((i + 1) < ntokens)
                    {
                        if (tokens[i + 1].type == 0)
                        this.currentLocations[this.currentMemory] = tokens[i + 1].value; //argument is a number
                        else
                        {
                            var s = this.Symbols[tokens[i + 1]]; //if it's a string, it must resolve to a number.
                            if (s != null) this.currentLocations[this.currentMemory] = s.value;
                            else
                            {
                                this.lst.WriteLine(
                              "***Error: Undefined symbol "+tokens[i].str+". Line "+lineNumber); this.errorCnt++;
                            }
                        }
                    }
                    else
                    {
                        this.lst.WriteLine(
                      "***Error: Too few arguments. Line"+lineNumber); this.errorCnt++;
                    }
                    i = i + 2; //skip over arguments
                }
                else //look up token, add to currentValue.  If undefined on pass 1, skip.
                {
                    var s = this.Symbols[currentToken.str];
                    if (s != null)
                    {
                        var v;
                        v = (s.value << s.offset);
                        currentValue |= v;
                        hasCurrentValue = true;
                    }
                    else if (pass == 2)
                    {
                        this.lst.WriteLine(
                        "***Error. Undefined symbol "+tokens[i].str+". Line "+lineNumber); this.errorCnt++;
                    }
                    i++;  //skip token
                }

            }
            else //place numbers (zero-extended to  in currentValue at offset 0.
            {
                currentValue |= currentToken.value;
                hasCurrentValue = true;
                i++;
            }
        } //while(i < nTokens)
        if (hasCurrentValue == true) //finished all tokens. Store the generated instruction if pass = 2
        {
            if (pass == 2)
            {
                this.Memories[this.currentMemory][this.currentLocations[this.currentMemory]] = currentValue; //set value
                this.locsUsed[this.currentMemory]++;  //increment the count of used locations
                if (this.currentMemory == 0) pc = this.locsUsed[this.currentMemory];
            }
            this.currentLocations[this.currentMemory]++; //increment current location in that memory

        }
        return (pc);
    }//ProcessLine

    StringValue(s) {
        var radix = 10;
        var value = 0;
        var cval;
        for (var i = 0; i < s.length; i++)
        {
            switch (s[i])
            {
                case '0': cval = 0; break;
                case '1': cval = 1; break;
                case '2': cval = 2; break;
                case '3': cval = 3; break;
                case '4': cval = 4; break;
                case '5': cval = 5; break;
                case '6': cval = 6; break;
                case '7': cval = 7; break;
                case '8': cval = 8; break;
                case '9': cval = 9; break;
                case 'a': cval = 10; break;
                case 'b':
                    if (i == 1)
                    {
                        radix = 2;
                        cval = 0;
                    }
                    else cval = 11; break;
                case 'c': cval = 12; break;
                case 'd':
                    if (i == 1) cval = 0;
                    else cval = 13; break;
                case 'e': cval = 14; break;
                case 'f': cval = 15; break;
                case 'x': radix = 16; cval = 0; break;
                case 'h': radix = 16; cval = 0; break;
                default: cval = 0; break;
            }
            value = radix * value + cval;
        }
        return (value);
    }

}//Class Assembler
