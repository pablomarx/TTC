`timescale 1ns / 1ps 
module ramw(
	input clka,
	input [9:0] addra,
	input wea,
	input [31:0] dina,
	
	input clkb,
	input [9:0] addrb,
	output reg [31:0] doutb
);

reg [31:0] mem[511:0];

always @(posedge clka) begin
	if (wea) begin
		mem[addra] <= dina;
	end
end

always @(posedge clkb) begin
	doutb <= mem[addrb];
end

endmodule
 
