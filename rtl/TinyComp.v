`timescale 1ns / 1ps

module TinyComp(
input ClockIn, //50 Mhz board clock 
input Reset, //High true (BTN_SOUTH) 
output [7:0] LED,
input RxD,
output TxD
);

wire doSkip;
wire [31:00] WD; //write data to the register file
wire [31:00] RFAout; //register file port A read data
wire [31:00] RFBout; //register file port B read data
reg [10:0] PC;
wire [10:0] PCinc, PCinc2, PCmux;
wire [31:00] ALU;
wire [31:00] ALUresult;
wire [31:00] DM; //the Data memory (1K x 32) output
wire [31:00] IM; //the Instruction memory (1K x 32) output
wire Ph0; //the (buffered) clock
wire Ph0x;
wire testClock;

wire [2:0] Opcode;
wire [4:0] Ra, Rw;
wire [10:0] Rb;
wire Normal, RbConst, IO, Load, Store, StoreI, Jump; //Opcode decodes
wire [2:0] Skip;
wire Skn, Skz, Ski, Skge, Sknz, Skni, Skp;
wire [1:0] Rcy;
wire NoCycle, Rcy1, Rcy8;
wire [2:0] Funct;
wire AplusB, AminusB, Bplus1, Bminus1, AandB, AorB, AxorB;
wire WriteRF;

wire [31:0] Ain, Bin; //ALU inputs

reg [25:0] testCount;
wire InReady;
wire [31:0] InValue;
reg [7:0] LEDs;

//--------------- The I/O devices ---------------
wire [3:0] IOaddr; //16 IO devices for now.
wire readRX;
wire charReady;
wire [7:0] RXchar;
wire writeLED;
wire writeTX;
wire TXempty;
wire [7:0] TXchar;

assign IOaddr = Rb[4:1]; //device addresses are constants.
assign InReady = ~Rb[0] &
(((IOaddr == 0) & charReady) | //read RS232 RX
((IOaddr == 1) & TXempty)); //read RS232 TX

assign InValue = (IOaddr == 0) ? {24'b0, RXchar} : 32'b0;
assign TXchar = RFAout[7:0];
assign readRX = ~Rb[0] & (IOaddr == 0) & IO;

assign writeTX = Rb[0] & (IOaddr == 1) & IO;
assign writeLED = Rb[0] & (IOaddr == 2) & IO;

always @(posedge Ph0) if(writeLED) LEDs <= RFAout[7:0];
assign LED = LEDs;

rs232 user(
	.clock(Ph0),
	.reset(Reset),
	.readRX(readRX),
	.charReady(charReady),
	.RXchar(RXchar),
	
	.writeTX(writeTX),
	.TXempty(TXempty),
	.TXchar(TXchar),
	.TxD(TxD),
	.RxD(RxD)
);

//---------------------- The CPU ------------------------

always @(posedge testClock)
if(Reset) testCount <= 0;
else testCount <= testCount + 1;

always @(posedge Ph0)
if(Reset) PC <= 0;
else PC <= PCmux;

//Opcode fields
assign Rw = IM[31:27];
assign Ra = IM[26:22];
assign Rb = IM[21:11]; //larger than needed to address RF.
assign Funct = IM[10:8];
assign Rcy = IM[7:6];
assign Skip = IM[5:3];
assign Opcode = IM[2:0];

//Opcodes
assign Normal = Opcode == 0;
assign RbConst = Opcode == 1;
assign IO = Opcode == 2;
assign Load = Opcode == 3;
assign Store = Opcode == 4;
assign StoreI = Opcode == 5;
assign Jump = Opcode == 6;
//assign Const = Opcode == 7;

//Skips
assign Skn = (Skip == 1);
assign Skz = (Skip == 2);
assign Ski = (Skip == 3);
assign Skge = (Skip == 4);
assign Sknz = (Skip == 5);
assign Skni = (Skip == 6);
assign Skp = (Skip == 7);

//Cyclic shifts
assign NoCycle = (Rcy == 0);
assign Rcy1 = (Rcy == 1);
assign Rcy8 = (Rcy == 2);

//ALU functions
assign AplusB = Funct == 0;
assign AminusB = Funct == 1;
assign Bplus1 = Funct == 2;
assign Bminus1 = Funct == 3;
assign AandB = Funct == 4;
assign AorB = Funct == 5;
assign AxorB = Funct == 6;

//The Skip Tester.
assign doSkip =
(Normal | RbConst | IO) & //Opcode can skip
(
	(Skn & ALU[31]) |
	(Skz & (ALU == 0)) |
	(Ski & InReady) |
	(Skge & ~ALU[31]) |
	(Sknz & (ALU != 0)) |
	(Skni & ~InReady) |
	Skp
);

//The PC-related signals
assign PCinc = PC + 1;
assign PCinc2 = PC + 2;
assign PCmux =
Jump ? ALU[10:0] :
(Load & (Rw == 31)) ? DM[10:0] : //subroutine return
doSkip ? PCinc2 :
PCinc;

//Instantiate the WD multiplexer.
assign WD =
(Normal | RbConst | Store | StoreI ) ? ALU :
IO ? InValue:
Load ? DM:
Jump ? {21'b0, PCinc}:
{8'b0, IM[26:3]}; // 24-bit constant

assign WriteRF = (Rw != 0); //Writes to r0 are discarded.

//The input multiplexers for the ALU inputs
assign Ain = (Ra == 31) ? {21'b0, PC} : RFAout;
assign Bin = ( RbConst | Jump ) ? {21'b0, Rb} : RFBout;

//Instantiate the ALU: An adder/subtractor followed by a shifter
assign ALUresult =
AplusB ? Ain + Bin :
	AminusB ? Ain - Bin :
	Bplus1 ?Bin+1:
	Bminus1 ? Bin - 1 :
AandB ? Ain & Bin :
	AorB ?Ain|Bin:
	AxorB ? Ain ^ Bin :
	Ain & ~Bin; //A and not B

assign ALU =
NoCycle ? ALUresult :
Rcy1 ? {ALUresult[0], ALUresult[31:1]} :
Rcy8 ? {ALUresult[7:0], ALUresult[31:8]} :
{ALUresult[15:0], ALUresult[31:16]};

//Instantiate the instruction memory. A simple dual-port RAM.
ramx im(
	//the write port
	.clka(Ph0),
	.addra(RFBout[10:0]),
	.wea(StoreI),
	.dina(RFAout),
	
	//the read port
	.clkb(Ph0),
	.addrb(PCmux),
	.doutb(IM)
);

//Instantiate the data memory. A simple dual-port RAM.
ramw dm(
	//the write port
	.clka(Ph0),
	.addra(RFBout[10:0]),
	.wea(Store),
	.dina(RFAout),
	
	//the read port
	.clkb(~Ph0), //use ~Ph0 since we can't read DM until the address (from IM) is ready.
	.addrb(RFBout[10:0]),
	.doutb(DM) //the read port
);

//Instantiate the register file. This has three independent addresses, so two RAMs are needed.
ramz rfA(
	.a(Rw),
	.d(WD), //write port
	.dpra(Ra),
	.clk(Ph0),
	.we(WriteRF),
	.dpo(RFAout) //read port
);

ramz rfB(
	.a(Rw),
	.d(WD),
	.dpra(Rb[4:0]),
	.clk(Ph0),
	.we(WriteRF),
	.dpo(RFBout) //read port
);

BUFG ph1Buf(.I(Ph0x),.O(testClock));
BUFG ph0Buf(.I(Ph0x), .O(Ph0)); //Global clock buffer

//The design won't actually run at the 50MHz supplied board clock,
//so we use a Digital Clock Manager block to make Ph0 = 40 MHz.
//This can be ignored, unless you want to change the speed of the design.
DCM_SP #(
.CLKDV_DIVIDE(2.0),
.CLKFX_DIVIDE(10),
.CLKFX_MULTIPLY(8),
.CLKIN_DIVIDE_BY_2("FALSE"),
.CLKIN_PERIOD(20.0),
.CLKOUT_PHASE_SHIFT("NONE"),
.CLK_FEEDBACK("1X"),
.DESKEW_ADJUST("SYSTEM_SYNCHRONOUS"),
.DLL_FREQUENCY_MODE("LOW"),
.DUTY_CYCLE_CORRECTION("TRUE"),
.PHASE_SHIFT(0),
.STARTUP_WAIT("FALSE")
) TCdcm ( 
	.CLK0(),
	.CLK180(),
	.CLK270()
	.CLK2X()
	.CLK2X180()
	.CLK90()
	.CLKDV()
	.CLKFX(Ph0x)
	.CLKFX180()
	.LOCKED()
	.PSDONE()
	.STATUS()
	.CLKFB()
	.CLKIN(ClockIn)
	.PSCLK(1'b0)
	.PSEN(1'b0)
	.PSINCDEC(1'b0)
	.RST(Reset)
);

endmodule
