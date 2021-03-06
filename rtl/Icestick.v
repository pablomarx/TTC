`timescale 1ns / 1ps 
module Top (
	input clk,
	output [7:0] leds
);

// Clocks
wire clk40;
wire pll_locked;

pll my_pll(.clock_in(clk), .clock_out(clk40), .locked(pll_locked));

// TinyComp I/O
wire [31:0] IOvalue;
wire [31:0] IOaddr;
wire IOread;
wire IOwrite;

wire writeLED;
reg [7:0] LEDs;

assign writeLED = IOwrite & (IOaddr == 32'h000003ff);
assign leds = LEDs;

// The CPU
TinyComp tc(
	.Ph0(clk40), .Ph1(~clk40), .Reset(~pll_locked), 
	.IOaddr(IOaddr), .OutData(IOvalue), 
	.InData(32'b0), .InRdy(1'b1), .InStrobe(IOread), .OutStrobe(IOwrite)
);

always @(posedge clk40) begin
	if (writeLED) begin
		LEDs <= IOvalue[7:0];
	end
end

endmodule
